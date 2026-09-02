import {readFileSync} from 'node:fs';

const regular=readFileSync(new URL('./assets/DejaVuSans.ttf',import.meta.url)).toString('base64');
const bold=readFileSync(new URL('./assets/DejaVuSans-Bold.ttf',import.meta.url)).toString('base64');

export const documentFontStyle=`
  @font-face{font-family:'CPX Document';src:url(data:font/ttf;base64,${regular}) format('truetype');font-style:normal;font-weight:400}
  @font-face{font-family:'CPX Document';src:url(data:font/ttf;base64,${bold}) format('truetype');font-style:normal;font-weight:700}
  text{font-family:'CPX Document';font-style:normal}
`;
