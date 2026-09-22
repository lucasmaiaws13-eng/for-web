import {
  Hct,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  argbFromHex,
  hexFromArgb,
} from "@material/material-color-utilities";

import { SelectedTheme, TypeTheme } from "@revolt/state/stores/Theme";

/**
 * Superficies do tema do Callju.
 *
 * O Material gera os cinzas a partir da cor da marca, e mesmo no esquema
 * monocromatico eles saem lavados e com degraus largos demais. Esta escala foi
 * escolhida a mao: preto profundo, degraus curtos entre um nivel e outro e
 * linhas de contorno discretas, do jeito que os aplicativos escuros modernos
 * fazem. Assim a cor da marca aparece so onde ela e destaque de verdade.
 */
const SUPERFICIES_ESCURAS = {
  "surface-dim": "#08080a",
  surface: "#0c0c0e",
  "surface-bright": "#26262b",
  "surface-container-lowest": "#08080a",
  "surface-container-low": "#111113",
  "surface-container": "#151518",
  "surface-container-high": "#1c1c20",
  "surface-container-highest": "#24242a",
  "on-surface": "#ededf0",
  "on-surface-variant": "#a3a4ab",
  // Familias que na pratica sao superficie: sem isto elas continuavam saindo
  // do laranja e pintavam cartoes e listas inteiras de marrom
  // O container da cor principal vira superficie neutra com texto na cor da
  // marca: em tema escuro, qualquer laranja escurecido vira marrom
  "primary-container": "#1e1e23",
  "on-primary-container": "#f3aa73",
  secondary: "#c8c9d0",
  "on-secondary": "#1b1b1f",
  "secondary-container": "#1b1b1f",
  "on-secondary-container": "#e6e6ea",
  tertiary: "#c8c9d0",
  "on-tertiary": "#1b1b1f",
  "tertiary-container": "#1b1b1f",
  "on-tertiary-container": "#e6e6ea",
  outline: "#6b6c74",
  "outline-variant": "#2a2a30",
  "inverse-surface": "#ededf0",
  "inverse-on-surface": "#18181b",
  scrim: "#000000",
  shadow: "#000000",
};

const SUPERFICIES_CLARAS = {
  "surface-dim": "#dedee2",
  surface: "#fbfbfc",
  "surface-bright": "#ffffff",
  "surface-container-lowest": "#ffffff",
  "surface-container-low": "#f5f5f7",
  "surface-container": "#efeff2",
  "surface-container-high": "#e9e9ed",
  "surface-container-highest": "#e3e3e8",
  "on-surface": "#17171a",
  "on-surface-variant": "#55565d",
  "primary-container": "#e9e9ee",
  "on-primary-container": "#8a3f10",
  secondary: "#494a51",
  "on-secondary": "#ffffff",
  "secondary-container": "#e7e7ec",
  "on-secondary-container": "#1b1b1f",
  tertiary: "#494a51",
  "on-tertiary": "#ffffff",
  "tertiary-container": "#e7e7ec",
  "on-tertiary-container": "#1b1b1f",
  outline: "#85868d",
  "outline-variant": "#d5d5db",
  "inverse-surface": "#2b2b30",
  "inverse-on-surface": "#f2f2f5",
  scrim: "#000000",
  shadow: "#000000",
};

/**
 * Generate the Material variables from the given properties
 *
 * Currently only generates color keys
 */
export function createMaterialColourVariables<P extends string>(
  theme: SelectedTheme,
  prefix: P,
): addPrefixToObject<MaterialColours, P> {
  switch (theme.preset) {
    case "you":
      return Object.entries(
        generateMaterialYouScheme(
          theme.accent,
          theme.darkMode,
          theme.contrast,
          theme.variant,
        ),
      ).reduce(
        (d, [key, value]) => ({
          ...d,
          [`${prefix}${key}`]: value,
        }),
        {} as addPrefixToObject<MaterialColours, P>,
      );
    default:
      return {} as never;
  }
}

/**
 * Create R,G,B triplets for MDUI variables
 */
export function createMduiColourTriplets<P extends string>(
  theme: SelectedTheme,
  prefix: P,
): addPrefixToObject<MaterialColours, P> {
  const variables = createMaterialColourVariables(theme, prefix);

  for (const key in variables) {
    const [_, r, g, b] = /#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})/i.exec(
      variables[key as keyof typeof variables] as string,
    )!;

    variables[key as keyof typeof variables] =
      `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}` as never;
  }

  return variables;
}

type addPrefixToObject<T, P extends string> = {
  [K in keyof T as K extends string ? `${P}${K}` : never]: T[K];
};

type _addSuffixToObject<T, S extends string> = {
  [K in keyof T as K extends string ? `${K}${S}` : never]: T[K];
};

type MaterialColours = {
  primary: string;
  "on-primary": string;
  "primary-container": string;
  "on-primary-container": string;
  secondary: string;
  "on-secondary": string;
  "secondary-container": string;
  "on-secondary-container": string;
  tertiary: string;
  "on-tertiary": string;
  "tertiary-container": string;
  "on-tertiary-container": string;
  error: string;
  "on-error": string;
  "error-container": string;
  "on-error-container": string;

  "primary-fixed": string;
  "primary-fixed-dim": string;
  "on-primary-fixed": string;
  "on-primary-fixed-variant": string;
  "secondary-fixed": string;
  "secondary-fixed-dim": string;
  "on-secondary-fixed": string;
  "on-secondary-fixed-variant": string;
  "tertiary-fixed": string;
  "tertiary-fixed-dim": string;
  "on-tertiary-fixed": string;
  "on-tertiary-fixed-variant": string;

  "surface-dim": string;
  surface: string;
  "surface-bright": string;

  "surface-container-lowest": string;
  "surface-container-low": string;
  "surface-container": string;
  "surface-container-high": string;
  "surface-container-highest": string;

  "on-surface": string;
  "on-surface-variant": string;
  outline: string;
  "outline-variant": string;

  "inverse-surface": string;
  "inverse-on-surface": string;
  "inverse-primary": string;

  scrim: string;
  shadow: string;
};

/**
 * Generate a Material You colour scheme
 * @param accent Accent colour in hex format
 * @param darkMode Dark mode
 * @param constrat Constrast level
 * @returns Material colours
 */
function generateMaterialYouScheme(
  accent: string,
  darkMode: boolean,
  contrast: number,
  variant: TypeTheme["m3Variant"],
): MaterialColours {
  const hct = Hct.fromInt(argbFromHex(accent));

  let scheme;
  switch (variant) {
    case "content":
      scheme = new SchemeContent(hct, darkMode, contrast);
      break;
    case "expressive":
      scheme = new SchemeExpressive(hct, darkMode, contrast);
      break;
    case "fidelity":
      scheme = new SchemeFidelity(hct, darkMode, contrast);
      break;
    case "fruit_salad":
      scheme = new SchemeFruitSalad(hct, darkMode, contrast);
      break;
    case "monochrome":
      scheme = new SchemeMonochrome(hct, darkMode, contrast);
      break;
    case "neutral":
      scheme = new SchemeNeutral(hct, darkMode, contrast);
      break;
    case "rainbow":
      scheme = new SchemeRainbow(hct, darkMode, contrast);
      break;
    case "vibrant":
      scheme = new SchemeVibrant(hct, darkMode, contrast);
      break;
    case "caju":
    case "legacy":
    case "tonal_spot":
    default:
      scheme = new SchemeTonalSpot(hct, darkMode, contrast);
      break;
  }

  // Segundo esquema, em escala de cinza pura.
  //
  // O Material deriva TODAS as cores da matiz da semente, inclusive as
  // superficies. Com semente laranja os cinzas saem amarronzados, do mesmo
  // jeito que uma semente azul deixa tudo azulado. Como aqui a gente quer
  // fundo preto/cinza neutro e laranja apenas nos destaques, geramos as
  // superficies a partir do SchemeMonochrome e mantemos o esquema colorido
  // so para primary, secondary, tertiary e error.
  const neutro = new SchemeMonochrome(hct, darkMode, contrast);

  // No tema Legacy as superficies herdam a matiz quente do destaque, que era
  // o visual amadeirado antigo. Em todas as outras, inclusive no tema padrao,
  // elas vem do esquema monocromatico: preto e cinza neutros de verdade, com
  // o laranja aparecendo so nos destaques.
  const superficie =
    variant === "caju" || variant === "legacy" ? scheme : neutro;

  const cores = {
    primary: hexFromArgb(scheme.primary),
    "on-primary": hexFromArgb(scheme.onPrimary),
    "primary-container": hexFromArgb(scheme.primaryContainer),
    "on-primary-container": hexFromArgb(scheme.onPrimaryContainer),
    secondary: hexFromArgb(scheme.secondary),
    "on-secondary": hexFromArgb(scheme.onSecondary),
    "secondary-container": hexFromArgb(scheme.secondaryContainer),
    "on-secondary-container": hexFromArgb(scheme.onSecondaryContainer),
    tertiary: hexFromArgb(scheme.tertiary),
    "on-tertiary": hexFromArgb(scheme.onTertiary),
    "tertiary-container": hexFromArgb(scheme.tertiaryContainer),
    "on-tertiary-container": hexFromArgb(scheme.onTertiaryContainer),
    error: hexFromArgb(scheme.error),
    "on-error": hexFromArgb(scheme.onError),
    "error-container": hexFromArgb(scheme.errorContainer),
    "on-error-container": hexFromArgb(scheme.onErrorContainer),

    "primary-fixed": hexFromArgb(scheme.primaryFixed),
    "primary-fixed-dim": hexFromArgb(scheme.primaryFixedDim),
    "on-primary-fixed": hexFromArgb(scheme.onPrimaryFixed),
    "on-primary-fixed-variant": hexFromArgb(scheme.onPrimaryFixedVariant),
    "secondary-fixed": hexFromArgb(scheme.secondaryFixed),
    "secondary-fixed-dim": hexFromArgb(scheme.onSecondaryFixed),
    "on-secondary-fixed": hexFromArgb(scheme.onSecondaryFixed),
    "on-secondary-fixed-variant": hexFromArgb(scheme.onSecondaryFixedVariant),
    "tertiary-fixed": hexFromArgb(scheme.tertiaryFixed),
    "tertiary-fixed-dim": hexFromArgb(scheme.tertiaryFixedDim),
    "on-tertiary-fixed": hexFromArgb(scheme.onTertiaryFixed),
    "on-tertiary-fixed-variant": hexFromArgb(scheme.onTertiaryFixedVariant),

    "surface-dim": hexFromArgb(superficie.surfaceDim),
    surface: hexFromArgb(superficie.surface),
    "surface-bright": hexFromArgb(superficie.surfaceBright),

    "surface-container-lowest": hexFromArgb(superficie.surfaceContainerLowest),
    "surface-container-low": hexFromArgb(superficie.surfaceContainerLow),
    "surface-container": hexFromArgb(superficie.surfaceContainer),
    "surface-container-high": hexFromArgb(superficie.surfaceContainerHigh),
    "surface-container-highest": hexFromArgb(superficie.surfaceContainerHighest),

    "on-surface": hexFromArgb(superficie.onSurface),
    "on-surface-variant": hexFromArgb(superficie.onSurfaceVariant),
    outline: hexFromArgb(superficie.outline),
    "outline-variant": hexFromArgb(superficie.outlineVariant),

    "inverse-surface": hexFromArgb(superficie.inverseSurface),
    "inverse-on-surface": hexFromArgb(superficie.inverseOnSurface),
    "inverse-primary": hexFromArgb(scheme.inversePrimary),

    scrim: hexFromArgb(superficie.scrim),
    shadow: hexFromArgb(superficie.shadow),
  };

  // O Legacy fica exatamente como era. Todo o resto usa a escala propria.
  if (variant === "caju" || variant === "legacy") return cores;

  return {
    ...cores,
    ...(darkMode ? SUPERFICIES_ESCURAS : SUPERFICIES_CLARAS),
  };
}
