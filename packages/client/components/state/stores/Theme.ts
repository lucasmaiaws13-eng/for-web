import { Accessor, createSignal } from "solid-js";

import {
  FONT_KEYS,
  Fonts,
  MONOSPACE_FONT_KEYS,
  MonospaceFonts,
} from "@revolt/ui/themes/fonts";

import { State } from "..";

import { AbstractStore } from ".";

/**
 * Temas prontos: cor e esquema ja combinados.
 *
 * Escolher um tema pronto nao deixa trocar a cor dele, de proposito: a graca
 * de um tema pronto e ele ser uma escolha fechada. Quem quiser mexer na cor
 * usa o tema personalizado.
 */
export const TEMAS_PRONTOS = {
  callju: { nome: "Callju", cor: "#e8823c", variante: "vibrant" },
  grafite: { nome: "Grafite", cor: "#9fa8b4", variante: "neutral" },
  oceano: { nome: "Oceano", cor: "#4aa3e0", variante: "vibrant" },
  mata: { nome: "Mata", cor: "#57c27c", variante: "vibrant" },
  vinho: { nome: "Vinho", cor: "#e0566a", variante: "vibrant" },
  legacy: { nome: "Legacy", cor: "#e8823c", variante: "legacy" },
} as const;

export type TemaPronto = keyof typeof TEMAS_PRONTOS;

export type TypeTheme = {
  /**
   * Base theme preset
   */
  preset: "you";

  /**
   * Light/dark mode
   */
  mode: "light" | "dark" | "system";

  /**
   * Tema escolhido: um dos prontos ou o personalizado
   */
  tema: TemaPronto | "personalizado";

  /**
   * Accent
   * (Material You)
   */
  m3Accent: string;

  /**
   * Constrast
   * (Material You)
   */
  m3Contrast: number;

  /**
   * Variant
   * (Material You)
   */
  m3Variant:
    | "legacy"
    | "caju"
    | "monochrome"
    | "neutral"
    | "tonal_spot"
    | "vibrant"
    | "expressive"
    | "fidelity"
    | "content"
    | "rainbow"
    | "fruit_salad";

  /**
   * Whether to permit blurry surfaces
   */
  blur: boolean;

  /**
   * Interface font
   */
  interfaceFont: Fonts;

  /**
   * Monospace font
   */
  monospaceFont: MonospaceFonts;

  /**
   * Message size
   */
  messageSize: number;

  /**
   * Spacing between message groups
   */
  messageGroupSpacing: number;
};

export type SelectedTheme = Pick<
  TypeTheme,
  | "blur"
  | "interfaceFont"
  | "monospaceFont"
  | "messageSize"
  | "messageGroupSpacing"
> & {
  preset: "you";
  darkMode: boolean;

  accent: string;
  contrast: number;
  variant: TypeTheme["m3Variant"];
};

/**
 * Manages theme information
 */
export class Theme extends AbstractStore<"theme", TypeTheme> {
  prefersDark: Accessor<boolean>;

  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "theme");

    // handle prefers-color-scheme value and changes
    const [prefersDark, setPrefersDark] = createSignal(
      window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches,
    );

    this.prefersDark = prefersDark;

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => setPrefersDark(event.matches));

    this.toggleBlur = this.toggleBlur.bind(this);
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    /** nothing needs to be done */
  }

  /**
   * Generate default values
   */
  default(): TypeTheme {
    return {
      preset: "you",
      mode: "dark",

      tema: "callju",
      m3Accent: TEMAS_PRONTOS.callju.cor,
      m3Contrast: 0.0,
      // Preto neutro com laranja nos destaques: superficies monocromaticas
      // (ver materialTheme.ts) e destaques num laranja fundo, que segura bem
      // o texto claro por cima. O laranja cheio da marca entra pelo degrade.
      m3Variant: "vibrant",

      interfaceFont: "Inter",
      monospaceFont: "Fira Code",

      blur: true,
      messageSize: 14,
      messageGroupSpacing: 12,
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeTheme>): TypeTheme {
    const data: TypeTheme = this.default();

    if (["light", "dark", "system"].includes(input.mode!)) {
      data.mode = input.mode!;
    }

    if (["you", "neutral"].includes(input.preset!)) {
      data.preset = input.preset!;
    }

    // Reset geral do tema.
    //
    // Quem nunca escolheu um tema por nome (ou seja, todo mundo que vem de
    // antes desta versao) recebe o padrao novo, e a cor guardada antes e
    // descartada de proposito: o visual antigo nao volta pela porta dos fundos.
    if (input.tema === "personalizado") {
      data.tema = "personalizado";

      if (
        input.m3Accent &&
        input.m3Accent.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/)
      ) {
        data.m3Accent = input.m3Accent;
      }
    } else if (input.tema && input.tema in TEMAS_PRONTOS) {
      const escolhido = TEMAS_PRONTOS[input.tema as TemaPronto];
      data.tema = input.tema as TemaPronto;
      data.m3Accent = escolhido.cor;
      data.m3Variant = escolhido.variante;
    }

    if (typeof input.blur === "boolean") {
      data.blur = input.blur;
    }

    if (typeof input.messageSize === "number") {
      data.messageSize = input.messageSize;
    }

    if (typeof input.messageGroupSpacing === "number") {
      data.messageGroupSpacing = input.messageGroupSpacing;
    }

    if (
      typeof input.monospaceFont === "string" &&
      MONOSPACE_FONT_KEYS.includes(input.monospaceFont)
    ) {
      data.monospaceFont = input.monospaceFont;
    }

    if (
      typeof input.interfaceFont === "string" &&
      FONT_KEYS.includes(input.interfaceFont)
    ) {
      data.interfaceFont = input.interfaceFont;
    }

    return data;
  }

  /**
   * Get the currently selected theme (considering system settings)
   */
  get activeTheme(): SelectedTheme {
    const opts = this.get();

    switch (opts.preset) {
      case "you":
        return {
          blur: opts.blur,
          interfaceFont: opts.interfaceFont,
          monospaceFont: opts.monospaceFont,
          messageSize: opts.messageSize,
          messageGroupSpacing: opts.messageGroupSpacing,
          preset: "you",
          darkMode:
            opts.mode === "dark" ||
            (opts.mode === "system" && this.prefersDark()),

          accent: opts.m3Accent,
          contrast: opts.m3Contrast,
          variant:
            opts.tema === "personalizado"
              ? "vibrant"
              : TEMAS_PRONTOS[opts.tema].variante,
        };
    }
  }

  /**
   * Get light/dark/system mode
   */
  get mode() {
    return this.get().mode;
  }

  /**
   * Set light/dark/system mode
   * @param mode Mode
   */
  setMode(mode: TypeTheme["mode"]) {
    this.set("mode", mode);
  }

  /**
   * Volta o tema para o padrao do Callju
   */
  restaurarPadrao() {
    const padrao = this.default();
    this.set("mode", padrao.mode);
    this.set("tema", padrao.tema);
    this.set("m3Accent", padrao.m3Accent);
    this.set("m3Variant", padrao.m3Variant);
    this.set("m3Contrast", padrao.m3Contrast);
  }

  /**
   * Tema escolhido agora
   */
  get tema() {
    return this.get().tema;
  }

  /**
   * Escolher um tema pronto
   */
  escolherTema(nome: TemaPronto) {
    const escolhido = TEMAS_PRONTOS[nome];
    this.set("tema", nome);
    this.set("m3Accent", escolhido.cor);
    this.set("m3Variant", escolhido.variante);
  }

  /**
   * Get current preset
   */
  get preset() {
    return this.get().preset;
  }

  /**
   * Set the active preset
   * @param preset Preset
   */
  setPreset(preset: TypeTheme["preset"]) {
    this.set("preset", preset);
  }

  /**
   * Get current accent
   */
  get m3Accent() {
    return this.get().m3Accent;
  }

  /**
   * Set the accent of the Material You theme
   * @param accent Accent
   */
  setM3Accent(accent: string) {
    // Mexer na cor e sempre tema seu: um tema pronto nao muda de cor
    this.set("tema", "personalizado");
    this.set("m3Accent", accent);
    this.set("m3Variant", "vibrant");
  }

  /**
   * Get current contrast
   */
  get m3Contrast() {
    return this.get().m3Contrast;
  }

  /**
   * Set the contrast of the Material You theme
   * @param contrast Contrast
   */
  setM3Contrast(contrast: number) {
    this.set("m3Contrast", contrast);
  }

  /**
   * Get current variant
   */
  get m3Variant() {
    return this.get().m3Variant;
  }

  /**
   * Set the variant of the Material You theme
   * @param variant Variant
   */
  setM3Variant(variant: TypeTheme["m3Variant"]) {
    this.set("m3Variant", variant);
  }

  /**
   * Get current blur state
   */
  get blur() {
    return this.get().blur;
  }

  /**
   * Toggle blur state
   */
  toggleBlur() {
    this.set("blur", !this.blur);
  }

  /**
   * Get current interface font
   */
  get interfaceFont() {
    return this.get().interfaceFont;
  }

  /**
   * Set interface font
   */
  setInterfaceFont(font: Fonts) {
    return this.set("interfaceFont", font);
  }

  /**
   * Get current monospace font
   */
  get monospaceFont() {
    return this.get().monospaceFont;
  }

  /**
   * Set monospace font
   */
  setMonospaceFont(font: MonospaceFonts) {
    return this.set("monospaceFont", font);
  }

  /**
   * Get current message size
   */
  get messageSize() {
    return this.get().messageSize;
  }

  /**
   * Set message size
   */
  set messageSize(size: number) {
    this.set("messageSize", size);
  }

  /**
   * Get current message group spacing
   */
  get messageGroupSpacing() {
    return this.get().messageGroupSpacing;
  }

  /**
   * Set message group spacing
   */
  set messageGroupSpacing(space: number) {
    this.set("messageGroupSpacing", space);
  }
}
