#!/usr/bin/env python3
"""Genera cambios de clave para cuentas existentes; no conecta con producción."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import uuid

ROOT = Path(__file__).resolve().parents[1]


def literal(value):
    if '\x00' in value:
        raise ValueError('El usuario no puede contener caracteres nulos.')
    return "E'" + value.replace('\\', '\\\\').replace("'", "''") + "'"


def password_reset_sql(changes):
    if not changes:
        raise ValueError('Debes indicar al menos un usuario existente.')
    accounts, seen = [], set()
    for username, password in changes:
        username = username.strip()
        if not username or len(username) > 1000 or '\x00' in username:
            raise ValueError('Introduce un usuario válido.')
        if username.casefold() in seen:
            raise ValueError('No repitas un usuario en el mismo archivo.')
        if len(password) < 12 or len(password) > 256 or password != password.strip():
            raise ValueError('Cada clave debe tener de 12 a 256 caracteres, sin espacios al principio o final.')
        seen.add(username.casefold())
        salt = secrets.token_bytes(16)
        hashed = salt.hex() + ':' + hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000, 32).hex()
        accounts.append({'username': username, 'password_hash': hashed})
    payload = literal(json.dumps(accounts, ensure_ascii=False, separators=(',', ':')))
    tag = '$guido_claves_' + uuid.uuid4().hex + '$'
    while tag in payload:
        tag = '$guido_claves_' + uuid.uuid4().hex + '$'
    selected = ','.join('lower(' + literal(account['username']) + ')' for account in accounts)
    return f"""-- Cambia claves de cuentas existentes en public.users. No crea ni elimina usuarios.
-- Conserva nombre, correo, rol y aprobación. Ejecutar en el SQL Editor de tu Supabase.
BEGIN;
DO {tag}
DECLARE
  account jsonb;
  target_user_id uuid;
BEGIN
  FOR account IN SELECT value FROM jsonb_array_elements({payload}::jsonb) LOOP
    BEGIN
      SELECT id INTO STRICT target_user_id FROM public.users
      WHERE lower(username)=lower(account->>'username') FOR UPDATE;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'No existe el usuario: %', account->>'username';
      WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'El usuario no es único: %', account->>'username';
    END;
    UPDATE public.users SET password_hash=account->>'password_hash',
      reset_token=NULL, reset_token_expires=NULL, updated_at=now()
    WHERE id=target_user_id;
    IF to_regclass('public.guido_sessions') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.guido_sessions WHERE user_id=$1' USING target_user_id;
    END IF;
  END LOOP;
END
{tag};
SELECT username AS usuario, name AS nombre, role AS rol, status AS estado
FROM public.users WHERE lower(username) IN ({selected}) ORDER BY username;
COMMIT;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--usuarios', type=int, default=4, help='Cantidad de cuentas que actualizar (por defecto: 4).')
    args = parser.parse_args()
    if not 1 <= args.usuarios <= 100:
        parser.error('Indica entre 1 y 100 usuarios.')
    print('Se preparará un SQL; no se conectará ni se cambiará nada en Supabase todavía.')
    changes = []
    for index in range(args.usuarios):
        print('\nCuenta ' + str(index + 1) + ' de ' + str(args.usuarios))
        username = input('Usuario existente: ')
        password = getpass.getpass('Nueva clave (mínimo 12 caracteres, no se muestra): ')
        if password != getpass.getpass('Repite la nueva clave: '):
            raise ValueError('Las claves no coinciden. No se generó ningún archivo.')
        changes.append((username, password))
    sql = password_reset_sql(changes)
    directory = ROOT / '.local' / 'administracion'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = directory / ('cambiar-claves-' + uuid.uuid4().hex[:12] + '.sql')
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
        output.write(sql)
    print('\nArchivo SQL: ' + str(target))
    print('Abre ese archivo y ejecuta su contenido en el SQL Editor del Supabase de producción.')
    print('Si algún usuario no existe o no es único, la transacción revierte todos los cambios.')
    print('Después cierra sesión y vuelve a entrar con las nuevas claves.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, EOFError, KeyboardInterrupt) as error:
        raise SystemExit(str(error) or 'Operación cancelada; no se cambiaron claves.')
