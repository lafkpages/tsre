// Dummy program for converting temperatures
// to test tsre deobfuscation

function convertFtoC(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

function convertCtoF(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

function convertKtoC(kelvin: number): number {
  return kelvin - 273.15;
}

function convertCtoK(celsius: number): number {
  return celsius + 273.15;
}

for await (const line of console) {
  if (!line || line === "exit") {
    break;
  }

  // Line format: <temp> <unit> in/to <unit>
  // Spaces are optional, and units are case-insensitive
  const [, temp, unit1, unit2] =
    line.match(/(\d+(?:\.\d+)?)\s*([fkc])\s*(?:in|to)\s*([fkc])/i) || [];
  if (!temp || !unit1 || !unit2) {
    console.log("Invalid input");
    continue;
  }

  const tempNum = parseFloat(temp);
  let result: number;
  switch (unit1.toLowerCase() + unit2.toLowerCase()) {
    case "fc":
      result = convertFtoC(tempNum);
      break;
    case "cf":
      result = convertCtoF(tempNum);
      break;
    case "kc":
      result = convertKtoC(tempNum);
      break;
    case "ck":
      result = convertCtoK(tempNum);
      break;
    default:
      console.log("Invalid conversion");
      continue;
  }

  console.log(result);
}
