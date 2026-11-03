import { VERSION } from "./version.js";

export function helpText() {
  return `TuT-Cures v${VERSION}: terminal AI doctor

Usage:
  tut                 start an interactive session
  tut logo [--color=truecolor|256|plain]
                      preview the logo
  tut ask <task>      do one task in plain words (asks before every command)
  tut setup           choose a provider and save your API key (hidden input)
  tut models          fetch the provider's models and choose one
  tut models list     print all model ids;  tut models set <id>  choose directly
  tut test            send a tiny test message with the chosen model
  tut config          show settings and which keys are set (keys are masked)
  tut config path     print the folder where tut keeps its files
  tut --version, -v   print the version
  tut --help, -h      show this help
  tut --no-logo       start without the logo

  tut status          show the background service and its jobs
  tut job start <command>   run a command in the background (survives closing the terminal)
  tut job stop <id>   stop one job;  tut job list  list jobs
  tut logs <id>       show a job's output
  tut-kill            stop the background service and every job it runs

Environment:
  NO_COLOR=1          disable colors and use the plain logo
  OPENROUTER_API_KEY, XAI_API_KEY (or GROK_API_KEY), ANTHROPIC_API_KEY,
  OPENAI_API_KEY, GEMINI_API_KEY (or GOOGLE_API_KEY)
                      API keys; these win over the saved key file
  TUT_PROVIDER        force a provider: openrouter, grok, anthropic, openai, gemini
  TUT_HOME            use another folder than ~/.tut
  TUT_NO_SERVICE=1    do not start the background service
`;
}
