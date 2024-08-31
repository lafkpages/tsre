# tsre

A JavaScript and TypeScript reverse engineering tool.

## Installation

> [!WARNING]  
> tsre is not yet published to npm. You must install it from
> the GitHub repository, and run it with `bun run . --help`
> instead of `tsre --help` or `bun run tsre --help`.

> [!NOTE]  
> tsre uses [Bun][bun] APIs, so it must be
> installed and run with Bun.

```sh
bun install -g tsre
```

## Usage

First, you'll need to configure OpenAI. If you have a normal
OpenAI API key, you can set it with:

```sh
export OPENAI_API_KEY="your-api-key"
```

If you are using something local like `llama-server`, you can
set the URL with:

```sh
export OPENAI_API_KEY=" "
export OPENAI_BASE_URL="http://localhost:8080"
```

Note that setting `OPENAI_API_KEY` is required by the
[OpenAI JS library][openai-js], even if Llama.cpp will not
actually check it.

To deobfuscate a JavaScript file:

```sh
tsre deobfuscate file.js -o file-deobfuscated.js
```

[bun]: https://bun.sh
[openai-js]: https://npmjs.com/package/openai
