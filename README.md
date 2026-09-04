# Seanime ZDOST

Custom Seanime server and desktop builds maintained in the ZDOST fork.

Forked from [5rahim/seanime](https://github.com/5rahim/seanime).

> [!IMPORTANT]
> Seanime does not provide, host, or distribute any media content. Users are responsible for obtaining media through legal means and complying with their local laws. Extensions listed on the app are unaffiliated with Seanime and may be removed if they violate copyright laws.

## Custom builds

- AioStreams torrent results preserve the provider's configured ordering.
- Seanime Denshi includes native MPC-HC handoff for debrid and torrent URLs.
- Windows Denshi builds use the ZDOST update feed.
- Docker deployments can build directly from this repository.

Releases are available from the [ZDOST releases](https://github.com/ZDOSt/seanime/releases) page.

## Build

Install Node.js, Go, and the platform tools required by the Denshi client. The full build guide is in [DEVELOPMENT_AND_BUILD.md](DEVELOPMENT_AND_BUILD.md).

For the web interface:

```powershell
cd seanime-web
npm install
npm run build
```

For the Windows Denshi installer, build the server sidecar first, place it at `seanime-denshi/binaries/seanime-server-windows.exe`, then run:

```powershell
cd seanime-denshi
npm install
npm run build:win
```

## Copyright and media responsibility

This fork remains distributed under the original project license; see [LICENSE](LICENSE).

> [!NOTE]
> For copyright-related requests, please contact the maintainer using the contact information provided on [the copyright policy page](https://seanime.app/docs/policies).
