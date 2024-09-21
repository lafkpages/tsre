# tsre

A JavaScript and TypeScript reverse engineering tool.

Go from this:

```js
function y(b){return(b-32)*5/9}function z(b){return b*9/5+32}function A(b){return b-273.15}function B(b){return b+273.15}for await(let b of console){if(!b||b==="exit")break;const[,q,w,x]=b.match(/(\d+(?:\.\d+)?)\s*([fkc])\s*(?:in|to)\s*([fkc])/i)||[];if(!q||!w||!x){console.log("Invalid input");continue}const j=parseFloat(q);let g;switch(w.toLowerCase()+x.toLowerCase()){case"fc":g=y(j);break;case"cf":g=z(j);break;case"kc":g=A(j);break;case"ck":g=B(j);break;default:console.log("Invalid conversion");continue}console.log(g)}
```

To this:

```js
function convertFahrenheitToCelsius(fahrenheitTemperature) {
  return ((fahrenheitTemperature - 32) * 5) / 9;
}

function convertCelsiusToFahrenheit(celsiusTemperature) {
  return (celsiusTemperature * 9) / 5 + 32;
}

function convertKelvinToCelsius(kelvinTemperature) {
  return kelvinTemperature - 273.15;
}

function convertCelsiusToKelvin(celsiusTemperature) {
  return celsiusTemperature + 273.15;
}

for await (let consoleLogEntries of console) {
  if (!consoleLogEntries || consoleLogEntries === "exit") break;

  const [, temperatureValue, matchedTemperatureValue, matchedTemperature] =
    consoleLogEntries.match(
      /(\d+(?:\.\d+)?)\s*([fkc])\s*(?:in|to)\s*([fkc])/i,
    ) || [];

  if (!temperatureValue || !matchedTemperatureValue || !matchedTemperature) {
    console.log("Invalid input");
    continue;
  }

  const parsedTemperature = parseFloat(temperatureValue);
  let g;

  switch (
    matchedTemperatureValue.toLowerCase() + matchedTemperature.toLowerCase()
  ) {
    case "fc":
      g = convertFahrenheitToCelsius(parsedTemperature);
      break;

    case "cf":
      g = convertCelsiusToFahrenheit(parsedTemperature);
      break;

    case "kc":
      g = convertKelvinToCelsius(parsedTemperature);
      break;

    case "ck":
      g = convertCelsiusToKelvin(parsedTemperature);
      break;

    default:
      console.log("Invalid conversion");
      continue;
  }

  console.log(g);
}
```

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
