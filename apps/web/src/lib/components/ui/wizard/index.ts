import Root from "./wizard.svelte";
import Header from "./wizard-header.svelte";
import Steps from "./wizard-steps.svelte";
import Content from "./wizard-content.svelte";
import Footer from "./wizard-footer.svelte";

export {
  Root,
  Header,
  Steps,
  Content,
  Footer,
  //
  Root as WizardRoot,
  Header as WizardHeader,
  Steps as WizardSteps,
  Content as WizardContent,
  Footer as WizardFooter,
};

export type { WizardStep, WizardContext } from "./wizard.types.js";
