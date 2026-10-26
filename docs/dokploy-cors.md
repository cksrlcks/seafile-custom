# Dokploy(Seafile 템플릿 배포)에서 CORS 켜기 — 화면에서만 작업

Dokploy의 Compose/템플릿 서비스는 Traefik 설정 파일이 아니라 **컨테이너 라벨**로 라우팅한다.
SSH 없이 Dokploy 화면의 Compose 편집기에서 라벨만 추가하면 된다. (2026-10-26 실서버에서 검증한 방법.)

## 배경: 왜 템플릿 라우터에 붙여야 하나

- Seafile 템플릿은 `seafile-websecure`(443)·`seafile-web`(80) 라우터를 라벨로 정의하고 있고, 기본 `priority=1`이다.
- Dokploy의 Domains 탭에 도메인을 등록하면 Dokploy가 `cloud-seafile-xxxxxx-N-web` 같은 라우터를 **추가로** 주입한다. 이 라우터는 priority가 없어 기본값(규칙 길이 ≈ 33)이라 템플릿 라우터(1)보다 먼저 매칭된다.
- Dokploy가 주입하는 라우터에 우리가 `middlewares` 라벨을 붙여도 배포 때 Dokploy가 자기 라벨로 덮어써서 사라진다.
- 그래서 **템플릿 라우터의 priority를 50으로 올려** 그쪽이 요청을 받게 하고, 거기에 미들웨어를 붙인다. seadoc 라우터는 100이라 `/sdoc-server`, `/socket.io`는 그대로 seadoc이 받는다.
- Cloudflare Tunnel(와일드카드)은 Traefik의 80(`web`)으로 들어오므로 `seafile-web`에도 똑같이 붙인다.

## 할 일

Dokploy → Seafile 서비스 → **General** 탭 Compose 편집기 → `seafile:` 서비스의 `labels:`를 아래처럼 고치고 **Deploy**.
(기존 줄에서 `priority=1` 두 곳을 `50`으로 바꾸고, 끝에 8줄을 추가한다.)

```yaml
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.seafile-websecure.rule=Host(`${SEAFILE_SERVER_HOSTNAME}`)"
      - "traefik.http.routers.seafile-websecure.entrypoints=websecure"
      - "traefik.http.routers.seafile-websecure.tls=true"
      - "traefik.http.routers.seafile-websecure.priority=50"
      - "traefik.http.routers.seafile-websecure.service=seafile"
      - "traefik.http.routers.seafile-web.rule=Host(`${SEAFILE_SERVER_HOSTNAME}`)"
      - "traefik.http.routers.seafile-web.entrypoints=web"
      - "traefik.http.routers.seafile-web.priority=50"
      - "traefik.http.routers.seafile-web.service=seafile"
      - "traefik.http.services.seafile.loadbalancer.server.port=80"
      # --- seadrive 데스크톱 앱용 CORS ---
      - "traefik.http.routers.seafile-websecure.middlewares=seafile-cors"
      - "traefik.http.routers.seafile-web.middlewares=seafile-cors"
      - "traefik.http.middlewares.seafile-cors.headers.accesscontrolallowmethods=GET,POST,PUT,DELETE,OPTIONS"
      - "traefik.http.middlewares.seafile-cors.headers.accesscontrolallowheaders=Authorization,Content-Type,Content-Range,Content-Disposition,X-SEAFILE-OTP"
      - "traefik.http.middlewares.seafile-cors.headers.accesscontrolalloworiginlist=http://tauri.localhost,tauri://localhost,http://localhost:1420"
      - "traefik.http.middlewares.seafile-cors.headers.accesscontrolexposeheaders=X-Seafile-OTP"
      - "traefik.http.middlewares.seafile-cors.headers.accesscontrolmaxage=600"
      - "traefik.http.middlewares.seafile-cors.headers.addvaryheader=true"
```

Domains 탭의 도메인은 그대로 두어도 된다(그 라우터는 남지만 쓰이지 않는다). `seadoc` 서비스 라벨은 손대지 않는다.

## 검증 (PC에서)

배포 직후 1분 정도는 컨테이너가 healthy가 아니라 Traefik이 404를 내므로 조금 기다렸다가 실행한다.

```bash
curl -si -X OPTIONS https://seafile.heavybear-lab.net/api2/auth-token/ -H "Origin: http://tauri.localhost" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"
```

기대 결과:

```
HTTP/1.1 200 OK
access-control-allow-headers: Authorization,Content-Type,Content-Range,Content-Disposition,X-SEAFILE-OTP
access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS
access-control-allow-origin: http://tauri.localhost
```

Seahub가 직접 답하면(`access-control-allow-origin: *`, `content-language: en`이 보임) 미들웨어가 안 붙은 것이다.
업로드 경로는 URL을 `/seafhttp/upload-api/x`, 헤더를 `content-range,content-disposition`으로 바꿔 같은 방식으로 확인한다.

## 참고

- Seafile 13의 Seahub는 자체적으로 `Access-Control-Allow-Origin: *`를 보내지만 preflight에 `Allow-Headers`가 없고 401에는 CORS 헤더가 없어서, `Authorization` 헤더를 쓰는 앱에는 부족하다. Traefik 미들웨어가 preflight를 가로채고 응답 헤더를 덮어쓰므로 중복 헤더 문제도 없다.
- `docs/traefik-cors.yml`: Application 타입 배포나 Traefik 설정 파일을 직접 관리할 때.
- `docs/nginx-cors.conf`: Dokploy 없이 nginx를 직접 운영할 때.
