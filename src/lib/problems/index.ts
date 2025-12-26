import problemsData from './problems.json';

export interface Problem {
    id: string;
    title: string;
    description: string;
    expectedAnswer: number | string;
}

export const PROBLEMS: Record<string, Problem> = problemsData;
