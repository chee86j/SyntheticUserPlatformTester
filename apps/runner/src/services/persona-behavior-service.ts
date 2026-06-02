export type PersonaTraits = {
  name: string;
  role: string;
  industry: string;
  technicalProficiency: number;
  domainExpertise: number;
  timePressure: number;
  patience: number;
  confidence: number;
  errorRecovery: number;
  riskTolerance: number;
  accessibilityNeeds: string[];
  behaviorNotes: string;
};

export type PersonaBehaviorThresholds = {
  maxWaitMs: number;
  abandonmentThreshold: number;
  retryTendency: number;
  explorationTendency: number;
};

export type PersonaBehaviorProfile = {
  promptInstructions: string[];
  thresholds: PersonaBehaviorThresholds;
};

export class PersonaBehaviorService {
  buildProfile(persona: PersonaTraits | null): PersonaBehaviorProfile {
    if (!persona) {
      return {
        promptInstructions: ["Use balanced behavior and cautious exploration."],
        thresholds: {
          maxWaitMs: 5000,
          abandonmentThreshold: 90,
          retryTendency: 0.25,
          explorationTendency: 0.35
        }
      };
    }

    const instructions: string[] = [];

    if (persona.technicalProficiency <= 35) {
      instructions.push("Prefer visible labels over icons and avoid hidden settings.");
      instructions.push("Avoid search or shortcuts unless they are obvious on screen.");
      instructions.push("Interpret vague language literally and ask for explicit cues through action choices.");
    }

    if (persona.timePressure >= 70) {
      instructions.push("Move quickly, skip long instructional text, and prefer direct paths.");
      instructions.push("When blocked, retry quickly before exploring deeper.");
    }

    if (persona.patience <= 35) {
      instructions.push("Do not wait long for loading states; abandon ambiguous steps early.");
    }

    if (persona.confidence <= 35) {
      instructions.push("After repeated errors, prefer fail or help-seeking actions instead of risky exploration.");
    }

    if (persona.domainExpertise >= 70) {
      instructions.push("Use domain terminology confidently and expect workflows to match real-world process order.");
    }

    if (persona.behaviorNotes.trim().length > 0) {
      instructions.push(`Behavior note: ${persona.behaviorNotes.trim()}`);
    }

    const maxWaitMs = clamp(
      1200 + Math.round((persona.patience * 30 + (100 - persona.timePressure) * 20) / 2),
      800,
      9000
    );

    const abandonmentThreshold = clamp(
      40 + Math.round((persona.patience + persona.confidence + persona.errorRecovery) / 3),
      35,
      100
    );

    const retryTendency = clamp01((persona.timePressure * 0.35 + persona.errorRecovery * 0.4 + persona.confidence * 0.25) / 100);
    const explorationTendency = clamp01((persona.technicalProficiency * 0.5 + persona.riskTolerance * 0.5) / 100);

    return {
      promptInstructions: instructions.length > 0 ? instructions : ["Use moderate pace and balanced exploration."],
      thresholds: {
        maxWaitMs,
        abandonmentThreshold,
        retryTendency,
        explorationTendency
      }
    };
  }

  estimateFrustrationDelta(input: {
    action: string;
    success: boolean;
    confidence: number;
    durationMs: number;
    thresholds: PersonaBehaviorThresholds;
  }): number {
    let delta = 0;

    if (!input.success) delta += 12;
    if (input.durationMs > input.thresholds.maxWaitMs) delta += 4;
    if (input.confidence < 0.45) delta += 3;
    if (input.action === "wait") delta += 1;

    return clamp(delta, -5, 20);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
