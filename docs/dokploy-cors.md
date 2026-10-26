# Dokploy(템플릿 배포)에서 CORS 켜기 — 화면에서만 작업

Dokploy의 Compose/템플릿 서비스는 Traefik 설정 파일이 아니라 **컨테이너 라벨**로 라우팅한다.
그래서 SSH 없이 Dokploy 화면의 Compose 편집기에서 라벨만 추가하면 된다.

## 방법 A (권장): 도메인을 라벨로 직접 관리

1. Dokploy → Seafile 서비스 → **Domains** 탭에서 기존 도메인을 삭제한다. (라벨과 UI 도메인이 둘 다 있으면 라우터가 겹친다.)
2. **General** 탭의 Compose 편집기에서 `seafile` 서비스에 아래를 넣고 저장 → **Deploy**.

```yaml
services:
  seafile:
    # ... 템플릿의 기존 내용은 그대로 두고 아래만 추가/병합 ...
    networks:
      - default
      - dokploy-network
    labels:
      - traefik.enable=true
      - traefik.docker.network=dokploy-network
      # https 라우터
      - traefik.http.routers.seafile.rule=Host(`seafile.heavybear-lab.net`)
      - traefik.http.routers.seafile.entrypoints=websecure
      - traefik.http.routers.seafile.tls.certresolver=letsencrypt
      - traefik.http.routers.seafile.service=seafile
      - traefik.http.routers.seafile.middlewares=seafile-cors
      - traefik.http.services.seafile.loadbalancer.server.port=80
      # http → https
      - traefik.http.routers.seafile-http.rule=Host(`seafile.heavybear-lab.net`)
      - traefik.http.routers.seafile-http.entrypoints=web
      - traefik.http.routers.seafile-http.middlewares=redirect-to-https@file
      - traefik.http.routers.seafile-http.service=seafile
      # CORS 미들웨어 (seadrive 데스크톱 앱용)
      - traefik.http.middlewares.seafile-cors.headers.accesscontrolallowmethods=GET,POST,PUT,DELETE,OPTIONS
      - traefik.http.middlewares.seafile-cors.headers.accesscontrolallowheaders=Authorization,Content-Type,Content-Range,Content-Disposition,X-SEAFILE-OTP
      - traefik.http.middlewares.seafile-cors.headers.accesscontrolalloworiginlist=http://tauri.localhost,tauri://localhost,http://localhost:1420
      - traefik.http.middlewares.seafile-cors.headers.accesscontrolexposeheaders=X-Seafile-OTP
      - traefik.http.middlewares.seafile-cors.headers.accesscontrolmaxage=600
      - traefik.http.middlewares.seafile-cors.headers.addvaryheader=true

networks:
  dokploy-network:
    external: true
```

- 템플릿의 seafile 서비스가 80이 아닌 다른 포트를 쓰면 `loadbalancer.server.port`를 그 값으로 바꾼다. (Domains 탭에 있던 "Container Port"와 같은 값.)
- `redirect-to-https@file`은 Dokploy가 기본으로 넣어 두는 미들웨어다. 없다고 나오면 `seafile-http` 라우터 4줄을 빼도 된다(https로 직접 접속하면 됨).

## 방법 B: Dokploy 도메인 UI는 그대로 두고 미들웨어만 라벨로

1. **Domains** 탭 → **Preview Compose** 로 Dokploy가 생성한 라우터 이름을 확인한다. 예: `traefik.http.routers.seafile-ab12cd-715-websecure.rule=...` 에서 `seafile-ab12cd-715-websecure`.
2. Compose 편집기의 `seafile` 서비스 `labels:`에 방법 A의 **CORS 미들웨어 6줄**과 아래 한 줄을 추가 → Deploy.

```yaml
      - traefik.http.routers.<확인한 라우터 이름>.middlewares=seafile-cors
```

도메인을 다시 만들면 라우터 이름이 바뀌므로 그때 이 줄도 고쳐야 한다.

## 검증 (PC에서)

```bash
curl -si -X OPTIONS https://seafile.heavybear-lab.net/api2/auth-token/ -H "Origin: http://tauri.localhost" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"
```

응답에 `Access-Control-Allow-Origin: http://tauri.localhost` 가 **한 줄** 보이면 된다.
업로드 경로도 같은 방식으로 확인한다: URL을 `/seafhttp/upload-api/x`로, 헤더를 `content-range,content-disposition`으로.

## 참고

- `docs/traefik-cors.yml`: SSH로 Traefik 동적 설정 파일을 직접 두는 방식(Application 타입 배포나 수동 관리용).
- `docs/nginx-cors.conf`: Dokploy를 쓰지 않고 nginx를 직접 운영할 때.
