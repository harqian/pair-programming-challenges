// lib/challenges/index.ts

// Re-export everything from base
export * from './base';

// Re-export individual challenges
export { NoForLoops } from './NoForLoops';
export { ActivityTimer } from './ActivityTimer';
// Registry for dynamic instantiation
import { Challenge, type ChallengeContext } from './base';
import { NoForLoops } from './NoForLoops';
import { ActivityTimer } from './ActivityTimer';

type ChallengeConstructor = new (context: ChallengeContext, ...args: any[]) => Challenge;

export const CHALLENGES: Record<string, ChallengeConstructor> = {
    'no-for-loops': NoForLoops,
    'activity-timer': ActivityTimer,
};