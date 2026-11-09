// a-search: a-objective with a lexicographic search, package moves, and tabu memory.

import { lexiSearch } from './search.ts';
import { makeVersion } from './version.ts';

export default makeVersion(
  'a-search',
  "A': honest objective with a lexicographic search",
  "a-objective's builder; the search compares plan health, then roles and curve, then strength, tries the same mana value or job first, moves a payoff with its setup, and keeps a tabu list of 8. Ignores the seed.",
  lexiSearch,
);
