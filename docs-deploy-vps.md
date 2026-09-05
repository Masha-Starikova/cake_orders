# Деплой на VPS с оплатой в рублях

Цель: один раз настроить сервер, после чего `git push` в `main` обновляет сайт
без ручных действий. Сервер ничего не хранит: база данных это Google Sheets,
поэтому потеря сервера не теряет заказы.

---

## 1. Что арендовать

### 1.1 VPS

Требования проекта скромные: Next.js в проде ест 200–400 МБ RAM. Но сборка
(`next build`) хочет 1.5–2 ГБ. Поэтому:

| Параметр | Минимум | Рекомендация |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 ГБ + swap 2 ГБ | 2 ГБ |
| Диск | 15 ГБ SSD | 25 ГБ NVMe |
| ОС | Ubuntu 22.04 | Ubuntu 24.04 LTS |
| Цена | ~200 ₽/мес | ~300–500 ₽/мес |

Провайдеры с оплатой в рублях (карта РФ, СБП, ЮMoney): Timeweb Cloud, Selectel,
Beget, reg.ru, FirstVDS, VDSina, Hostkey. Выбирать по цене за 2 ГБ и наличию
дата-центра в Москве или Петербурге: ниже задержка для клиентов.

Что проверить перед оплатой:
- у тарифа есть **публичный IPv4** (иногда за него доплата);
- есть консоль восстановления в панели (если сломать SSH);
- есть снапшоты или бэкапы (не обязательно, сервер stateless, но удобно).

### 1.2 Домен

Регистрируется у того же провайдера или у reg.ru за рубли. Нужна одна
A-запись: `@` → IP сервера, и вторая `www` → тот же IP.

### 1.3 Важная проверка доступности

Сервер в России ходит наружу в два сервиса: `api.telegram.org` и
`sheets.googleapis.com` + `oauth2.googleapis.com`. Оба сейчас доступны из РФ,
но это стоит проверить в первые 10 минут после аренды:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://api.telegram.org
curl -sS -o /dev/null -w '%{http_code}\n' https://sheets.googleapis.com
curl -sS -o /dev/null -w '%{http_code}\n' https://oauth2.googleapis.com
```

Ожидание: любые коды 2xx/3xx/4xx. Таймаут или `000` означает, что провайдер
блокирует, и нужен другой провайдер.

Также: Google Cloud Console для создания сервис-аккаунта открывается из
браузера, не с сервера. Биллинг для Sheets API не нужен, поэтому ограничения
Google Cloud на оплату из РФ не мешают.


### 1.4 Сравнение провайдеров (сентябрь 2026, цены ориентировочные)

| Провайдер | Конфигурация ~2 ГБ | Цена/мес | IPv4 | DDoS | Оплата | Плюсы / минусы |
|---|---|---|---|---|---|---|
| Selectel VDS | 1 vCPU / 2 ГБ / 25 ГБ | ~250–300 ₽ | включён | L3/L4 включена | карты РФ | самая низкая цена с IPv4 в комплекте; панель чуть сложнее |
| FirstVDS | от 1 vCPU / 2 ГБ | ~300–400 ₽ | включён | базовая, L7 платно | карты, СБП | дёшево, есть СБП; тарифы-конструкторы |
| Beget | 1 ядро / 2 ГБ / 15 ГБ | ~510 ₽ + IPv4 ~150 ₽ | доплата | L3/L4 включена | карты РФ, ЮMoney | простейшая панель, бесплатные бэкапы; диск 15 ГБ тесноват для Docker |
| Timeweb Cloud | 2 vCPU / 2 ГБ / 40 ГБ | ~900 ₽ + IPv4 ~200 ₽ | доплата | L3/L4/L7 | карты, СБП, ЮMoney, SberPay | удобно, но дороже всех |

Рекомендация: **Selectel VDS** (фиксированный тариф, не «облачный сервер»)
по цене, либо **Beget** если важнее простая панель и бэкапы. Точные цены
смотреть на сайте в момент заказа: они меняются.

**Выбранный тариф: Selectel VDS 2-4-50** (2 vCPU, 4 ГБ RAM, 50 ГБ, 650 ₽/мес).
Решение: на сервере будут жить несколько небольших проектов, а не только
этот сайт. 4 ГБ хватает на 4–6 Next.js-приложений плюс сборка. Один общий
сервер дешевле и проще в обслуживании, чем несколько по 250 ₽: каждый
отдельный сервер тратит ~300 МБ на ОС и требует своей настройки и
обновлений. Отдельный сервер имеет смысл только для проекта, который нельзя
ронять вместе с остальными, или для чужого клиентского проекта.

В панели Selectel: раздел **VDS** (`my.selectel.ru/vds/default/servers`),
не «Облачные серверы» и не «Выделенные серверы»: у тех другой калькулятор
и цены в 5–20 раз выше.

При заказе выбрать: Ubuntu 24.04, локацию Москва/Петербург, диск от 20 ГБ,
IPv4, вход по SSH-ключу (если панель предлагает добавить ключ, добавить сразу).

---

## 2. Архитектура на сервере

Сервер общий для нескольких проектов, поэтому Caddy живёт отдельно от
проектов и один на всех.

```
Интернет ──443──▶ Caddy (свой compose, ~/proxy)
                    │ авто-HTTPS для всех доменов
                    │ docker-сеть "web"
                    ├── cake.ru      ──▶ cake_orders-app:3000   (~/apps/cake_orders)
                    ├── другой.ru    ──▶ project2-app:3000      (~/apps/project2)
                    └── ...
```

- **`~/proxy`**: один контейнер Caddy. Принимает 80/443, сам получает и
  продлевает сертификаты Let's Encrypt для каждого домена из `Caddyfile`,
  проксирует в контейнеры по имени. Добавить новый проект = добавить 3 строки
  в `Caddyfile` и перезапустить Caddy.
- **`~/apps/<проект>`**: у каждого проекта свой `git clone`, свой
  `docker-compose.yml`, свой `.env`. Контейнеры проекта не открывают порты
  наружу, они подключены к общей docker-сети `web`, где их видит Caddy.
- Проекты изолированы: падение или пересборка одного не трогает другие.
  Общая точка отказа только сам сервер и Caddy, который почти никогда не
  перезапускается.

Раскладка на диске:

```
/home/deploy/
├── proxy/
│   ├── docker-compose.yml
│   └── Caddyfile            ← все домены
└── apps/
    ├── cake_orders/         ← этот репозиторий
    │   ├── .env
    │   └── docker-compose.yml
    └── project2/
```

Почему Docker, а не `pm2` + `nginx` на голой системе: версия Node закреплена
в образе, разные проекты могут использовать разные версии, переезд на
другой VPS это `git clone` + `docker compose up`. Почему Caddy, а не nginx:
HTTPS без certbot, без cron на продление, конфиг из нескольких строк на домен.

---

## 3. Файлы в репозитории

### 3.1 `next.config.mjs`

```js
const nextConfig = {
  reactStrictMode: true,
  output: "standalone"
};
export default nextConfig;
```

### 3.2 `Dockerfile`

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Три стадии: зависимости, сборка, запуск. Финальный образ ~150 МБ, без
исходников и devDependencies.

### 3.3 `docker-compose.yml` (в репозитории проекта)

```yaml
services:
  app:
    build: .
    container_name: cake_orders-app
    env_file: .env
    restart: unless-stopped
    networks: [web]

networks:
  web:
    external: true
```

Портов наружу нет: к контейнеру ходит только Caddy через сеть `web`.
Сеть создаётся один раз на сервере: `docker network create web`.

### 3.4 Общий прокси `~/proxy` (на сервере, не в репозитории)

`~/proxy/docker-compose.yml`:

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [web]

volumes:
  caddy_data:
  caddy_config:

networks:
  web:
    external: true
```

`~/proxy/Caddyfile`:

```
cake.ru, www.cake.ru {
  encode gzip
  request_body {
    max_size 8MB
  }
  reverse_proxy cake_orders-app:3000
}

# следующий проект: ещё один такой блок
# project2.ru {
#   reverse_proxy project2-app:3000
# }
```

Домены подставить свои. Caddy при первом запуске сам получит сертификат:
для этого A-запись должна уже указывать на сервер, а порты 80 и 443 быть
открыты. После правки `Caddyfile`: `docker compose -f ~/proxy/docker-compose.yml restart`.

Rate limit для `/api/order`: в коде эндпоинта (`Map` с IP → время последних
запросов, 5 в минуту). Caddy умеет rate limit через плагин, но это требует
свой образ. Начать с кода.

### 3.5 `.dockerignore`

```
node_modules
.next
.git
.npm-cache
.env*
*.md
```

### 3.6 `.env.example`

Добавить комментарии, где брать каждое значение. Реальный `.env` создаётся
только на сервере руками.

---

## 4. Настройка сервера (один раз, ~40 минут)

Все команды выполняются по SSH под root сразу после аренды.

### 4.1 Пользователь и SSH

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

В `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no`.
`systemctl restart ssh`. Проверить вход под `deploy` **до** закрытия root-сессии.

### 4.2 Обновления и firewall

```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
dpkg-reconfigure -plow unattended-upgrades
```

`unattended-upgrades` ставит патчи безопасности сам. `fail2ban` банит перебор SSH.

### 4.3 Swap (если RAM 1–2 ГБ)

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Без swap `next build` на 1 ГБ упадёт по памяти.

### 4.4 Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Перелогиниться под `deploy`, проверить `docker ps`.

### 4.5 Общая сеть и прокси (один раз)

```bash
docker network create web
mkdir -p ~/proxy ~/apps && cd ~/proxy
nano docker-compose.yml     # содержимое из 3.4
nano Caddyfile              # содержимое из 3.4, свой домен
docker compose up -d
```

### 4.6 Первый деплой проекта руками

```bash
cd ~/apps && git clone git@github.com:<user>/cake_orders.git && cd cake_orders
cp .env.example .env && nano .env      # вписать 5 переменных
docker compose up -d --build
docker compose logs -f
```

Через минуту открыть `https://домен`. Caddy покажет сертификат, форма
откроется. Сделать тестовый заказ.

Для `git clone` по SSH серверу нужен deploy key: `ssh-keygen` под `deploy`,
публичный ключ добавить в GitHub → репозиторий → Settings → Deploy keys.

Второй проект добавляется так же: `git clone` в `~/apps/project2`,
свой `.env`, `docker compose up -d --build`, блок в `~/proxy/Caddyfile`,
перезапуск Caddy.

---

## 5. Автоматический деплой

Схема: push в `main` → GitHub Actions → SSH на сервер → `git pull` +
`docker compose up -d --build`. Сборка идёт на сервере, поэтому нужен swap
или 2 ГБ RAM.

### 5.1 `.github/workflows/deploy.yml`

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: deploy
          key: ${{ secrets.SSH_KEY }}
          script: |
            set -e
            cd ~/apps/cake_orders
            git pull --ff-only origin main
            docker compose up -d --build
            docker image prune -f
```

### 5.2 Секреты в GitHub

Settings → Secrets and variables → Actions:

- `SSH_HOST`: IP сервера;
- `SSH_KEY`: приватный ключ отдельной пары, созданной **только для деплоя**.
  Публичная часть добавляется в `/home/deploy/.ssh/authorized_keys`.

Переменные приложения (`TELEGRAM_*`, `GOOGLE_*`) в GitHub **не хранятся**.
Они лежат в `.env` на сервере, `git pull` их не трогает.

### 5.3 Что происходит при деплое

1. Push в `main`.
2. Через ~10 секунд GitHub запускает job, подключается к серверу.
3. `git pull` забирает код. `docker compose up -d --build` собирает новый
   образ (1–3 минуты) и подменяет контейнер `cake_orders-app`. Caddy и
   другие проекты не перезапускаются, сертификаты не трогаются.
4. Простой сайта: несколько секунд на переключение контейнера. Для кондитерской
   это приемлемо. Zero-downtime потребует второго контейнера и не стоит усилий.
5. Если сборка упала, старый контейнер продолжает работать. Ошибка видна в
   GitHub Actions.

### 5.4 Откат

```bash
cd ~/apps/cake_orders && git checkout <хэш-предыдущего-коммита> && docker compose up -d --build
```

Или `git revert` в `main` и push: деплой откатит сам.

---

## 6. Что работает автоматически после настройки

| Задача | Кто делает |
|---|---|
| Обновление сайта | GitHub Actions по push |
| HTTPS и продление сертификата | Caddy, за 30 дней до истечения |
| Перезапуск приложения при падении | Docker `restart: unless-stopped` |
| Запуск после перезагрузки сервера | Docker (сервис включён при установке) |
| Патчи безопасности ОС | `unattended-upgrades` |
| Защита SSH от перебора | `fail2ban` |
| Резервные копии заказов | не нужны, данные в Google Sheets |

Что остаётся руками, раз в несколько месяцев:
- `apt upgrade` для не-security обновлений и перезагрузка;
- обновить тег образа `node:20` → `node:22`, когда 20 выйдет из поддержки
  (апрель 2026 уже прошёл, при старте проекта сразу ставить `node:22-alpine`
  и `.nvmrc` = 22);
- проверить, что оплата VPS автопродлевается.

---

## 7. Мониторинг (минимум)

Сервер может тихо упасть, и первым это заметит клиент. Два дешёвых варианта:

1. **Внешний пинг.** UptimeRobot (бесплатно, 5 минут интервал) или российский
   аналог, проверяющий `https://домен/` и шлющий алерт в Telegram. Ноль кода.
2. **Самопроверка.** Cron на сервере раз в 5 минут:
   `curl -sf https://домен/ || <отправить в Telegram через тот же бот>`.
   Не поможет, если упал весь сервер.

Рекомендация: вариант 1 сразу, вариант 2 не нужен.

Логи приложения: `docker compose logs -f app`. Ошибки Sheets и Telegram
дополнительно пишутся в лист `Log` таблицы, поэтому в логи сервера ходить
почти не придётся.

---

## 8. Порядок работ по деплою

Вписывается в шаг 6 из `docs-architecture.md`, но файлы Docker можно
добавить раньше, на шаге 0, и проверять сборку локально:

- [ ] Шаг 0: `output: standalone`, `Dockerfile`, `docker-compose.yml`,
      `Caddyfile`, `.dockerignore`. Локально `docker compose up --build`
      с `localhost` в Caddyfile. Убедиться, что форма открывается.
- [ ] Когда API готов и проверен локально: арендовать VPS и домен, A-запись.
- [ ] Раздел 4 этого документа: настройка сервера, первый деплой руками.
- [ ] Раздел 5: workflow, секреты, тестовый push.
- [ ] Раздел 7: внешний мониторинг.
- [ ] README: раздел «Деплой» со ссылкой сюда.
