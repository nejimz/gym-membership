import { Sex } from '@prisma/client';

export type LeanMassInputs = {
  sex?: Sex | null;
  heightCm?: number | null;
  weightKg?: number | null;
  neckCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
};

/** US Navy body-fat % → lean mass (kg). Returns null when required inputs are missing. */
export function estimateLeanMassKg(input: LeanMassInputs): number | null {
  const { sex, heightCm, weightKg, neckCm, waistCm, hipsCm } = input;
  if (
    !sex ||
    heightCm == null ||
    weightKg == null ||
    neckCm == null ||
    waistCm == null ||
    heightCm <= 0 ||
    weightKg <= 0 ||
    neckCm <= 0 ||
    waistCm <= 0
  ) {
    return null;
  }

  let density: number;
  if (sex === Sex.MALE) {
    const abdomen = waistCm - neckCm;
    if (abdomen <= 0) return null;
    density =
      1.0324 -
      0.19077 * Math.log10(abdomen) +
      0.15456 * Math.log10(heightCm);
  } else {
    if (hipsCm == null || hipsCm <= 0) return null;
    const circumference = waistCm + hipsCm - neckCm;
    if (circumference <= 0) return null;
    density =
      1.29579 -
      0.35004 * Math.log10(circumference) +
      0.221 * Math.log10(heightCm);
  }

  if (density <= 0) return null;
  const bodyFatPct = 495 / density - 450;
  if (!Number.isFinite(bodyFatPct) || bodyFatPct < 0 || bodyFatPct >= 100) {
    return null;
  }

  return Math.round(weightKg * (1 - bodyFatPct / 100) * 10) / 10;
}

export function effectiveLeanMassKg(
  leanMassKg: number | null | undefined,
  estimatedLeanMassKg: number | null,
): number | null {
  if (leanMassKg != null) return leanMassKg;
  return estimatedLeanMassKg;
}
