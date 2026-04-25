# TLS proxy server

proxy server with faking domain in client-hello packet

## Quick start (development mode)

1. copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. start "remote" server:

   ```bash
   node src/remote.js
   ```

3. start local proxy server:

   ```bash
   node src/local.js
   ```

4. now connect to local proxy server via 8080 port:

   ```
   curl -x http://localhost:8080 https://www.google.com
   ```

## Production mode

Production mode requirements:

1. VPS to run remote server
2. domain to mimic to (recomended to use your own domain with your own landing page)

### Config

both sides (remote and local) must share same config (`.env` file):

| name            | default        | required | description                                                |
| --------------- | -------------- | -------- | ---------------------------------------------------------- |
| `APP_ENV`       | `"production"` | -        | app running mode: `"production"` or `"development"`        |
| `FAKE_HOST`     | `env.WS_HOST`  | -        | domain to mimic to                                         |
| `WS_HOST`       | -              | `true`   | websocket connection host, required in `"production"` mode |
| `WS_PORT`       | `12021`        | -        | websocket server port                                      |
| `WS_TOKEN`      | -              | `true`   | websocket auth token                                       |
| `REMOTE_HOST`   | `"localhost"`  | -        | remote server host                                         |
| `REMOTE_PORT`   | `10701`        | -        | remote server port                                         |
| `LOCAL_PORT`    | `5080`         | -        | local proxy server port                                    |
| `KEEPALIVE_SEC` | `30`           | -        | keep alive seconds for connections                         |
| `PROXY_ATTACH`  | `"tcp"`        | -        | proxy attach method: `"tcp"` or `"ws"`                     |

configure your nginx (or apache) to proxy `"/10chat.io"` path to websocket port,
e.i. nginx:

```
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      '';
}

location /10chat.io {
  proxy_pass          http://127.0.0.1:12021;
  proxy_http_version  1.1;
  proxy_set_header    X-Forwarded-For $remote_addr;
  proxy_set_header    Host $server_name:$server_port;
  proxy_set_header    Upgrade $http_upgrade;
  proxy_set_header    Connection $connection_upgrade;
}
```

### Start

- start remote server on your VPS:

  ```
  node src/remote.js
  ```

  or with pm2

  ```
  pm2 start src/remote.js --name "proxy"
  ```

- start local server on your local machine:

  ```
  node src/local.js
  ```

  or with pm2

  ```
  pm2 start src/local.js --name "proxy"
  ```
