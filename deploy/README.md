# AI 试验场 · 服务器部署

正式地址：[https://arena.yomage.com/](https://arena.yomage.com/)。网站已部署到 `ubuntu@124.221.20.152`，HTTP 自动跳转 HTTPS。

| 项目 | 配置 |
| --- | --- |
| DNS | `arena.yomage.com` 的 A 记录为 `124.221.20.152` |
| 当前版本 | `20260905T151050Z` |
| 版本目录 | `/var/www/arena.yomage.com/releases/20260905T151050Z` |
| Nginx 网站根目录 | `/var/www/arena.yomage.com/current`，指向当前版本 |
| Nginx 配置 | `/etc/nginx/sites-available/arena.yomage.com`，通过 `sites-enabled` 启用 |
| 访问日志 | `/var/log/nginx/arena.yomage.com.access.log` |
| 错误日志 | `/var/log/nginx/arena.yomage.com.error.log` |
| TLS 证书 | `/etc/letsencrypt/live/arena.yomage.com/` |
| ACME 验证目录 | `/var/www/arena.yomage.com/acme` |

仅上传 `site/` 对应的 44 个静态文件，包含首页、清单、8 份作品及其资源。完整制作工程、依赖和本地配置留在本机。没有额外启动 Node.js 服务。

## 本地文件

- `arena.yomage.com.nginx.conf`：首次申请证书前使用的 HTTP 配置。
- `arena.yomage.com.https.nginx.conf`：已安装的正式 HTTPS 配置，保留独立的 ACME 验证路径。
- `reload-nginx-arena.sh`：证书续期后的加载脚本，安装在 `/etc/letsencrypt/renewal-hooks/deploy/50-arena-nginx`；仅匹配本域名。
- `install-first-release.py`：首次安装脚本，要求上传包与校验清单一致；目标已存在时停止，避免误覆盖。
- `verify-release.py`：通过 HTTPS 核验每个文件的 SHA-256、MIME 类型和 404 行为。
- `../artifacts/site/deployment-arena.json`：当前发布文件清单与部署包 SHA-256。

## 后续更新与回退

1. 新作品先按测评归档流程加入 `results/` 和 `site/catalog.json`；运行 `npm run package:site`、`npm run test:site`，得到 `artifacts/ai-arena-deploy.zip`。
2. 更新发布清单并使用新的 UTC 时间作为版本号。上传新包，在服务器 `releases/` 下新建版本目录，解包并核验全部文件；不要覆盖旧版本或把完整本地项目上传到网站根目录。
3. 在同一网站目录中创建指向新版本的临时符号链接，再用 `mv -Tf` 原子替换 `current`。网页使用相对路径；Nginx 设置 `no-cache`，不让固定文件名的旧脚本或清单长时间缓存。
4. 按新清单运行 `verify-release.py`，浏览器确认项目列表、作品和提示词。回退时以相同方式让 `current` 指回保留的旧版本。

仅切换静态版本不需要重新启动服务。更改 Nginx 配置时先 `sudo nginx -t`，通过后再 `sudo systemctl reload nginx`。当前 `nginx-http-before-https.conf` 保留在网站根目录的上一层，可用于核对首次启用 HTTPS 前的配置。

## HTTPS 续期

复用服务器已有的 `certbot.timer`。本域名采用 webroot 验证，HTTP 的 `/.well-known/acme-challenge/` 不参与 HTTPS 跳转；续期成功后，通过限定本域名的 hook 检查并平滑加载 Nginx。

仅演练本域名续期：

```sh
sudo certbot renew --cert-name arena.yomage.com --dry-run --non-interactive --no-random-sleep-on-renew
```

首次签发证书到期日为 2026-12-04；自动续期演练已通过。域名和验证路径需要持续指向这台服务器。
