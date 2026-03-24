<div align="center">
  <h1>Censer Web</h1>
  <p><em>The Sacred Vessel of Communication</em></p>

  <p>
    <a href="https://work.episkopos.community/episkopos/censer-web/-/pipelines"><img src="https://work.episkopos.community/episkopos/censer-web/badges/main/pipeline.svg" alt="Pipeline Status"></a>
    <img src="https://img.shields.io/badge/license-AGPL--3.0--or--later-blue" alt="License">
    <img src="https://img.shields.io/badge/solid.js-1.9-blue?logo=solid" alt="SolidJS">
    <img src="https://img.shields.io/badge/vite-6-purple?logo=vite" alt="Vite">
  </p>
</div>

The web client for Censer, a sovereign chat platform. Based on [Stoat](https://github.com/stoatchat/stoatchat).

## Development Guide

Before contributing, review the [code style guidelines](./GUIDELINES.md).

### Prerequisites

- [Git](https://git-scm.com/install/)
- [mise-en-place](https://mise.jdx.dev/getting-started.html)

### Setup

```bash
# clone the repository
git clone --recursive https://work.episkopos.community/episkopos/censer-web.git
cd censer-web

# update submodules if you pull new changes
# git submodule init && git submodule update

# install all packages
mise install:frozen

# build deps
mise build:deps

# customise the .env
cp packages/client/.env.example packages/client/.env

# run dev server
mise dev

# run all CI checks locally
mise check
```

Then navigate to http://local.revolt.chat:5173.

### Using a local backend

By default, the client connects to a backend running on the same host (localhost). Open `/packages/client/.env` and set the local URL variables:

```env
VITE_API_URL=http://localhost:14702
VITE_WS_URL=ws://localhost:14703
VITE_MEDIA_URL=http://localhost:14704
VITE_PROXY_URL=http://localhost:14705
```

When these variables are not set, the client falls back to the production backend.

## Deployment

```bash
# install packages
mise install:frozen

# build dependencies
mise build:deps

# build for web
mise build

# build for production
mise build:prod
```

Deploy the `packages/client/dist` directory.

### Routes

The app uses the following routes:

- `/login`, `/pwa`, `/dev`, `/discover`
- `/settings`, `/invite`, `/bot`
- `/friends`, `/server`, `/channel`

See [packages/client/src/index.tsx](packages/client/src/index.tsx) for the route definitions.

## Related Projects

| Project | Description |
|---------|-------------|
| [Censer Community](https://work.episkopos.community/episkopos/community) | Development hub & dev environment |
| [Censer Backend](https://work.episkopos.community/episkopos/censer-backend) | API server (Rust) |
| [Censer Flutter](https://work.episkopos.community/episkopos/censer-flutter) | Mobile client (Flutter) |
| [Censer SDK (Dart)](https://work.episkopos.community/episkopos/censer-sdk-dart) | Dart SDK |
| [Unveil](https://work.episkopos.community/episkopos/unveil) | Community knowledge browser |
| [Postern](https://work.episkopos.community/episkopos/postern) | Migration & sync tool |

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
