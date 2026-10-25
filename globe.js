/* GUIDO — globo 3D nativo, sin bibliotecas de mapas ni rastreadores externos. */
(function () {
  "use strict";
  var DEG = Math.PI / 180;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var geometries;
  var provinceData = fetch("assets/data/provincias.json").then(response => response.ok ? response.json() : { provinces: [] }).then(data => data.provinces || []).catch(() => []);
  window.GuidoGeography = { provinces: provinceData };

  function point(longitude, latitude, radius) {
    var lat = latitude * DEG, lon = longitude * DEG, r = radius || 1;
    return [r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon)];
  }
  function inside(x, y, ring) {
    var hit = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }
  function buildGeometry(polygons, provinces) {
    var sphere = [], dots = [], lines = [], grid = [];
    function vertex(target, longitude, latitude, radius, color) {
      target.push.apply(target, point(longitude, latitude, radius).concat(color));
    }
    for (var lat = -90; lat < 90; lat += 5) for (var lon = -180; lon < 180; lon += 5) {
      [[lon, lat], [lon + 5, lat], [lon, lat + 5], [lon + 5, lat], [lon + 5, lat + 5], [lon, lat + 5]].forEach(function (p) { vertex(sphere, p[0], p[1], .995, [.025, .09, .18]); });
    }
    var regions = polygons.map(function (ring) {
      return { ring: ring, minX: Math.min.apply(null, ring.map(p => p[0])), maxX: Math.max.apply(null, ring.map(p => p[0])), minY: Math.min.apply(null, ring.map(p => p[1])), maxY: Math.max.apply(null, ring.map(p => p[1])) };
    });
    for (var y = -58; y <= 82; y += 1.5) for (var x = -180; x < 180; x += 1.5) {
      if (!regions.some(function (region) { return x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY && inside(x, y, region.ring); })) continue;
      var n = Math.abs(Math.round(x * 713 + y * 977)) % 17;
      var color = n === 0 ? [1, .24, .36] : n < 4 ? [.85, .94, 1] : [.2, .48, 1];
      vertex(dots, x, y, 1.006, color);
    }
    polygons.forEach(function (ring) {
      for (var i = 1; i < ring.length; i++) {
        var a = ring[i - 1], b = ring[i];
        if (Math.abs(a[0] - b[0]) < 35) { vertex(lines, a[0], a[1], 1.004, [.24, .55, 1]); vertex(lines, b[0], b[1], 1.004, [.24, .55, 1]); }
      }
    });
    var localRings = (provinces || []).map(province => province.outline).filter(ring => Array.isArray(ring) && ring.length > 2);
    if (localRings.length) {
      var coordinates = localRings.flat();
      var minLon = Math.min.apply(null, coordinates.map(p => p[0])), maxLon = Math.max.apply(null, coordinates.map(p => p[0]));
      var minLat = Math.min.apply(null, coordinates.map(p => p[1])), maxLat = Math.max.apply(null, coordinates.map(p => p[1]));
      var step = Math.max((maxLon - minLon) / 45, (maxLat - minLat) / 45);
      for (var localLat = minLat; localLat <= maxLat; localLat += step) for (var localLon = minLon; localLon <= maxLon; localLon += step) {
        if (!localRings.some(ring => inside(localLon, localLat, ring))) continue;
        var tint = Math.abs(Math.round(localLat * 300 + localLon * 91)) % 5;
        vertex(dots, localLon, localLat, 1.008, tint === 0 ? [1, .24, .36] : tint < 3 ? [.85, .94, 1] : [.2, .48, 1]);
      }
      localRings.forEach(function (ring) {
        for (var k = 1; k < ring.length; k++) {
          vertex(lines, ring[k - 1][0], ring[k - 1][1], 1.007, [.3, .57, .95]);
          vertex(lines, ring[k][0], ring[k][1], 1.007, [.3, .57, .95]);
        }
      });
    }
    for (var parallel = -60; parallel <= 60; parallel += 20) for (var l = -180; l < 180; l += 4) {
      vertex(grid, l, parallel, 1.002, [.16, .34, .58]); vertex(grid, l + 4, parallel, 1.002, [.16, .34, .58]);
    }
    for (var meridian = -180; meridian < 180; meridian += 30) for (var a = -88; a < 88; a += 4) {
      vertex(grid, meridian, a, 1.002, [.16, .34, .58]); vertex(grid, meridian, a + 4, 1.002, [.16, .34, .58]);
    }
    return { sphere: sphere, dots: dots, lines: lines, grid: grid };
  }
  function rotation(yaw, pitch) {
    var c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [c, s * sp, -s * cp, 0, cp, sp, s, -c * sp, c * cp];
  }
  function rotate(position, matrix) {
    return [matrix[0] * position[0] + matrix[3] * position[1] + matrix[6] * position[2],
      matrix[1] * position[0] + matrix[4] * position[1] + matrix[7] * position[2],
      matrix[2] * position[0] + matrix[5] * position[1] + matrix[8] * position[2]];
  }

  function Globe(scene, geometry) {
    this.scene = scene; this.canvas = scene.querySelector("canvas"); this.geometry = geometry;
    this.welcome = scene.dataset.globe === "welcome"; this.yaw = 70 * DEG; this.pitch = 19 * DEG;
    this.zoom = this.welcome ? 1 : 3.3; this.width = 0; this.height = 0; this.frame = 0; this.visible = false; this.lastTime = 0; this.markers = [];
    this.initializeRenderer();
    var self = this;
    new ResizeObserver(function () { self.resize(); }).observe(scene);
    new IntersectionObserver(function (entries) {
      self.visible = entries[0].isIntersecting;
      if (self.visible) { self.resize(); self.request(); }
      else { cancelAnimationFrame(self.frame); self.frame = 0; self.lastTime = 0; }
    }, { threshold: .05 }).observe(scene);
    document.addEventListener("visibilitychange", function () { self.lastTime = 0; if (!document.hidden) self.request(); });
    reduced.addEventListener("change", function () { self.request(); });
    if (!this.welcome) this.bindControls();
    this.resize();
  }
  Globe.prototype.initializeRenderer = function () {
    var canvas = this.canvas, self = this;
    try {
      var gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: !this.welcome });
      if (!gl) throw new Error("WebGL no disponible");
      this.gl = gl;
      function shader(type, source) {
        var result = gl.createShader(type); gl.shaderSource(result, source); gl.compileShader(result);
        if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error("No se pudo compilar el globo");
        return result;
      }
      var vertex = shader(gl.VERTEX_SHADER, "attribute vec3 aPosition;attribute vec3 aColor;uniform mat3 uRotation;uniform vec2 uScale;uniform float uCenter;uniform float uPoint;varying vec3 vColor;varying vec3 vPosition;void main(){vec3 p=uRotation*aPosition;vColor=aColor;vPosition=p;gl_Position=vec4(p.x*uScale.x,p.y*uScale.y+uCenter,-p.z*.4,1.0);gl_PointSize=uPoint;}");
      var fragment = shader(gl.FRAGMENT_SHADER, "precision mediump float;uniform int uMode;varying vec3 vColor;varying vec3 vPosition;void main(){if(uMode==0){float light=.42+.58*max(dot(normalize(vPosition),normalize(vec3(-.5,.8,1.0))),0.0);float rim=pow(1.0-max(vPosition.z,0.0),3.0);gl_FragColor=vec4(vColor*light+vec3(.03,.14,.3)*rim,1.0);}else{if(vPosition.z<0.0)discard;float alpha=uMode==2?.36:.95;if(uMode==1){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;alpha*=1.0-smoothstep(.24,.5,d);}gl_FragColor=vec4(vColor,alpha);}}");
      var program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("No se pudo iniciar el globo");
      this.program = program;
      this.locations = {};
      ["uRotation", "uScale", "uCenter", "uPoint", "uMode"].forEach(name => { self.locations[name] = gl.getUniformLocation(program, name); });
      this.positionAttribute = gl.getAttribLocation(program, "aPosition"); this.colorAttribute = gl.getAttribLocation(program, "aColor");
      this.buffers = {};
      Object.entries(this.geometry).forEach(function (entry) {
        var buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(entry[1]), gl.STATIC_DRAW);
        self.buffers[entry[0]] = { buffer: buffer, count: entry[1].length / 6 };
      });
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      canvas.addEventListener("webglcontextlost", function (event) {
        event.preventDefault();
        var replacement = canvas.cloneNode(false); canvas.replaceWith(replacement); self.canvas = replacement;
        self.gl = null; self.context = replacement.getContext("2d"); self.resize(); self.request();
      });
    } catch (error) {
      this.gl = null;
      if (canvas.getContext("webgl")) { var next = canvas.cloneNode(false); canvas.replaceWith(next); this.canvas = next; }
      this.context = this.canvas.getContext("2d");
    }
  };
  Globe.prototype.resize = function () {
    this.width = this.scene.clientWidth; this.height = this.scene.clientHeight;
    if (!this.width || !this.height) return;
    var ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.ratio = ratio;
    var pixelWidth = Math.round(this.width * ratio), pixelHeight = Math.round(this.height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.radius = Math.min(this.width, this.height) * (this.welcome ? .46 : .43) * this.zoom;
    this.centerY = this.height * .5;
    this.draw();
    if (this.welcome) this.request();
  };
  Globe.prototype.project = function (longitude, latitude) {
    var p = rotate(point(longitude, latitude, 1.015), rotation(this.yaw, this.pitch));
    return { x: this.width / 2 + p[0] * this.radius, y: this.centerY - p[1] * this.radius, front: p[2] > .04 };
  };
  Globe.prototype.draw = function () {
    if (!this.width || !this.height) return;
    var self = this, matrix = rotation(this.yaw, this.pitch), gl = this.gl;
    if (gl) {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
      gl.uniformMatrix3fv(this.locations.uRotation, false, matrix);
      gl.uniform2f(this.locations.uScale, this.radius * 2 / this.width, this.radius * 2 / this.height);
      gl.uniform1f(this.locations.uCenter, 1 - this.centerY * 2 / this.height);
      gl.uniform1f(this.locations.uPoint, Math.min(4, 1.8 + this.zoom * .25) * this.ratio);
      [["sphere", gl.TRIANGLES, 0], ["grid", gl.LINES, 2], ["lines", gl.LINES, 2], ["dots", gl.POINTS, 1]].forEach(function (item) {
        var data = self.buffers[item[0]];
        gl.bindBuffer(gl.ARRAY_BUFFER, data.buffer);
        gl.enableVertexAttribArray(self.positionAttribute); gl.vertexAttribPointer(self.positionAttribute, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(self.colorAttribute); gl.vertexAttribPointer(self.colorAttribute, 3, gl.FLOAT, false, 24, 12);
        gl.uniform1i(self.locations.uMode, item[2]); gl.drawArrays(item[1], 0, data.count);
      });
    } else if (this.context) {
      var ctx = this.context;
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); ctx.clearRect(0, 0, this.width, this.height);
      var gradient = ctx.createRadialGradient(this.width / 2 - this.radius * .35, this.centerY - this.radius * .4, 0, this.width / 2, this.centerY, this.radius);
      gradient.addColorStop(0, "#103d71"); gradient.addColorStop(.8, "#071c36"); gradient.addColorStop(1, "#194c80");
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(this.width / 2, this.centerY, this.radius, 0, Math.PI * 2); ctx.fill();
      [["grid", .25], ["lines", .7]].forEach(function (layer) {
        var values = self.geometry[layer[0]]; ctx.strokeStyle = "rgba(81,147,245," + layer[1] + ")"; ctx.lineWidth = .7; ctx.beginPath();
        for (var i = 0; i < values.length; i += 12) {
          var a = rotate(values.slice(i, i + 3), matrix), b = rotate(values.slice(i + 6, i + 9), matrix);
          if (a[2] < 0 || b[2] < 0) continue;
          ctx.moveTo(self.width / 2 + a[0] * self.radius, self.centerY - a[1] * self.radius);
          ctx.lineTo(self.width / 2 + b[0] * self.radius, self.centerY - b[1] * self.radius);
        }
        ctx.stroke();
      });
      var dots = this.geometry.dots;
      for (var i = 0; i < dots.length; i += 6) {
        var p = rotate(dots.slice(i, i + 3), matrix);
        if (p[2] < 0) continue;
        ctx.fillStyle = "rgb(" + dots.slice(i + 3, i + 6).map(c => Math.round(c * 255)).join(",") + ")";
        ctx.beginPath(); ctx.arc(this.width / 2 + p[0] * this.radius, this.centerY - p[1] * this.radius, Math.min(2, 1 + this.zoom * .13), 0, Math.PI * 2); ctx.fill();
      }
    }
    var projected = [];
    this.markers.forEach(function (marker) {
      var p = self.project(marker.longitude, marker.latitude);
      var marginX = (marker.element.offsetWidth || 44) / 2 + 4;
      var marginY = (marker.element.offsetHeight || 44) / 2 + 4;
      marker.element.hidden = true;
      if (p.front && p.x >= marginX && p.x <= self.width - marginX && p.y >= marginY && p.y <= self.height - marginY) projected.push({ x: p.x, y: p.y, count: marker.count, zoneCount: marker.zoneCount, marker: marker });
    });
    var groups = window.GuidoTerritory ? window.GuidoTerritory.clusterProjected(projected, 64) : projected.map(p => ({ x: p.x, y: p.y, count: p.count, members: [p] }));
    groups.forEach(function (group) {
      var marker = group.members[0].marker, button = marker.element;
      button.hidden = false; button.textContent = new Intl.NumberFormat("es-DO", { notation: group.count > 999 ? "compact" : "standard" }).format(group.count);
      button.style.transform = "translate(" + group.x + "px," + group.y + "px) translate(-50%,-50%)";
      button.classList.toggle("is-cluster", group.members.length > 1);
      button.__cluster = group.members.length > 1 ? group : null;
      button.setAttribute("aria-label", (group.members.length > 1 ? group.zoneCount + " zonas cercanas: " + group.count + " registros visibles" : marker.label) + ". Ver zonas y sectores.");
    });
    this.scene.dataset.renderer = gl ? "webgl" : "compatible";
    this.scene.dataset.ready = "true";
  };
  Globe.prototype.request = function () {
    if (this.frame || !this.width || !this.height || document.hidden) return;
    var self = this;
    this.frame = requestAnimationFrame(function tick(time) {
      self.frame = 0;
      var animate = self.welcome && self.visible && !reduced.matches && !document.hidden;
      if (animate && self.lastTime) self.yaw += Math.min(time - self.lastTime, 80) * .000025;
      if (!self.lastTime || time - self.lastTime > (self.gl ? 32 : 70) || !animate) { self.draw(); self.lastTime = time; }
      if (animate) self.frame = requestAnimationFrame(tick);
    });
  };
  Globe.prototype.focus = function (latitude, longitude, zoom) {
    this.yaw = -longitude * DEG; this.pitch = latitude * DEG; this.zoom = zoom || 5; this.resize();
  };
  Globe.prototype.bindControls = function () {
    var self = this, drag = null;
    this.scene.querySelectorAll("[data-globe-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.dataset.globeAction === "center") self.focus(18.8, -70.2, 3.3);
        else { self.zoom = Math.min(128, Math.max(.8, self.zoom * (button.dataset.globeAction === "in" ? 1.35 : 1 / 1.35))); self.resize(); }
        self.scene.dataset.zoom = self.zoom.toFixed(2);
      });
    });
    this.scene.addEventListener("pointerdown", function (event) {
      if (event.target.tagName !== "CANVAS") return;
      drag = { x: event.clientX, y: event.clientY, yaw: self.yaw, pitch: self.pitch, touch: event.pointerType === "touch" };
      if (!drag.touch) { event.target.setPointerCapture(event.pointerId); event.target.focus({ preventScroll: true }); }
    });
    this.scene.addEventListener("pointermove", function (event) {
      if (!drag) return;
      self.yaw = drag.yaw + (event.clientX - drag.x) * .006;
      if (!drag.touch) self.pitch = Math.max(-1.4, Math.min(1.4, drag.pitch + (event.clientY - drag.y) * .006));
      self.request();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => self.scene.addEventListener(name, function () { drag = null; }));
    this.scene.addEventListener("wheel", function (event) {
      if (!event.ctrlKey && document.activeElement !== self.canvas) return;
      event.preventDefault(); self.zoom = Math.min(128, Math.max(.8, self.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12))); self.resize();
    }, { passive: false });
    this.scene.addEventListener("keydown", function (event) {
      if (event.target !== self.canvas) return;
      if (event.key === "ArrowLeft") self.yaw -= .12;
      else if (event.key === "ArrowRight") self.yaw += .12;
      else if (event.key === "ArrowUp") self.pitch = Math.max(-1.4, self.pitch - .1);
      else if (event.key === "ArrowDown") self.pitch = Math.min(1.4, self.pitch + .1);
      else if (event.key === "+" || event.key === "=") self.zoom = Math.min(128, self.zoom * 1.25);
      else if (event.key === "-") self.zoom = Math.max(.8, self.zoom / 1.25);
      else if (event.key.toLowerCase() === "r") { self.focus(18.8, -70.2, 3.3); event.preventDefault(); return; }
      else return;
      event.preventDefault(); self.resize();
    });
  };

  document.addEventListener("DOMContentLoaded", async function () {
    var scenes = Array.from(document.querySelectorAll("[data-globe]"));
    try {
      var response = await fetch("assets/data/mundo.json");
      if (!response.ok) throw new Error("Geografía no disponible");
      geometries = buildGeometry(await response.json(), await provinceData);
      var instances = scenes.map(scene => new Globe(scene, geometries));
      var map = instances.find(globe => !globe.welcome);
      window.GuidoGlobe = { map: map, instances: instances };
      window.dispatchEvent(new Event("guido:globe-ready"));
    } catch (error) {
      var list = document.getElementById("territoryZoneList");
      if (list) list.textContent = "No pudimos cargar la geografía. Recarga la página para volver a intentarlo.";
    }
  });
})();
