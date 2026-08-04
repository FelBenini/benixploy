import type { Component } from "svelte";

export type WizardStep = {
  title: string;
  description?: string;
  icon?: Component;
};

export type WizardContext = {
  readonly step: number;
  readonly currentStep: WizardStep;
  readonly stepCount: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly steps: WizardStep[];
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
};
