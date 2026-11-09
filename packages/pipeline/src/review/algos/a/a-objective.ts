// a-objective: the current builder's code with the honest objective and its swap search.

import { localSearch } from './builder.ts';
import { makeVersion } from './version.ts';

export default makeVersion(
  'a-objective',
  "A': current builder with the honest objective",
  "Copy of the core builder: theme cards counted once by theme-rules.json, plan health in place of min(enablers, payoffs), payoff gate in every pass, the copy's swap search. Ignores the seed.",
  localSearch,
);
