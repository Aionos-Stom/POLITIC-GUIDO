#!/usr/bin/env python3
"""Prepara un alta manual en public.users. No conecta ni escribe en Supabase."""
import getpass
import hashlib
import os
from pathlib import Path
import re
import secrets
import uuid

ROOT = Path(__file__).resolve().parents[1]


def literal(value):
    if '\x00' in value:
        raise ValueError('Los campos no pueden contener caracteres nulos.')
    return "E'" + value.replace('\\', '\\\\').replace("'", "''") + "'"


def administrator_sql(name, username, email, password, phone=''):
    name, username, email, phone = name.strip(), username.strip(), email.strip().lower(), phone.strip()
    if not name or not username or len(name) > 1000 or len(username) > 1000:
        raise ValueError('Nombre y usuario son obligatorios (máximo 1000 caracteres).')
    if len(email) > 320 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise ValueError('Introduce un correo válido para la recuperación del acceso.')
    if len(password) < 12 or len(password) > 256 or password != password.strip():
        raise ValueError('La contraseña debe tener de 12 a 256 caracteres, sin espacios al principio o final.')
    if phone and len(re.sub(r'\D', '', phone)) != 10:
        raise ValueError('El teléfono debe tener diez dígitos, o dejarse vacío.')
    salt = secrets.token_bytes(16)
    stored = salt.hex() + ':' + hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000, 32).hex()
    tag = '$guido_admin_' + uuid.uuid4().hex + '$'
    while tag in '\n'.join([name, username, email, phone]):
        tag = '$guido_admin_' + uuid.uuid4().hex + '$'
    return f"""-- Alta manual para el SQL Editor del proyecto Supabase de producción.
-- No crea cuentas en auth.users ni modifica cuentas existentes.
BEGIN;
DO {tag}
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE lower(username)=lower({literal(username)}) OR lower(email)=lower({literal(email)})) THEN
    RAISE EXCEPTION 'Ya existe ese usuario o correo. No se ha modificado ninguna cuenta.';
  END IF;
END
{tag};
INSERT INTO public.users (id,name,username,email,phone,password_hash,role,status,theme)
VALUES ('{uuid.uuid4()}',{literal(name)},{literal(username)},{literal(email)},{literal(phone)},{literal(stored)},'Administrador','Aprobado','light')
RETURNING id,username,name,role,status;
COMMIT;
"""


def main():
    print('Alta manual de administrador. No se conectará a Supabase.')
    name = input('Nombre completo: ')
    username = input('Usuario para iniciar sesión: ')
    email = input('Correo de recuperación: ')
    phone = input('Teléfono (opcional): ')
    password = getpass.getpass('Contraseña (mínimo 12 caracteres, no se muestra): ')
    confirmation = getpass.getpass('Repite la contraseña: ')
    if password != confirmation:
        raise ValueError('Las contraseñas no coinciden.')
    sql = administrator_sql(name, username, email, password, phone)
    directory = ROOT / '.local' / 'administracion'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = directory / ('crear-admin-' + uuid.uuid4().hex[:12] + '.sql')
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
        output.write(sql)
    print('\nSQL preparado en: ' + str(target))
    print('Abre ese archivo y ejecútalo en el SQL Editor de Supabase para crear la cuenta.')
    print('Puedes repetir el comando para crear otros administradores con usuarios y correos distintos.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, EOFError, KeyboardInterrupt) as error:
        raise SystemExit(str(error) or 'Operación cancelada; no se creó ninguna cuenta.')
