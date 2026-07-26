// server/src/services/emergencyStop.ts
// v1.9: Emergency stop circuit breaker

import { PrismaClient } from "@prisma/client";
import { eventBus } from "../lib/eventBus";
import type { EmergencyStopDto, EmergencyStopInput, EmergencyStopEvent } from "../../../shared/types";

const db = new PrismaClient();

export class EmergencyStopService {
  private static instance: EmergencyStopService;
  private cachedState: EmergencyStopDto | null = null;

  static getInstance(): EmergencyStopService {
    if (!EmergencyStopService.instance) {
      EmergencyStopService.instance = new EmergencyStopService();
    }
    return EmergencyStopService.instance;
  }

  async getState(): Promise<EmergencyStopDto> {
    const state = await db.emergencyStop.findUnique({
      where: { id: "singleton" },
    });

    if (!state) {
      // Create default state
      const created = await db.emergencyStop.create({
        data: {
          id: "singleton",
          active: false,
        },
      });

      const dto: EmergencyStopDto = {
        active: created.active,
        reason: created.reason ?? undefined,
        stoppedAt: created.stoppedAt?.getTime() ?? undefined,
        stoppedBy: created.stoppedBy ?? undefined,
        updatedAt: created.updatedAt.getTime(),
      };

      this.cachedState = dto;
      return dto;
    }

    const dto: EmergencyStopDto = {
      active: state.active,
      reason: state.reason ?? undefined,
      stoppedAt: state.stoppedAt?.getTime() ?? undefined,
      stoppedBy: state.stoppedBy ?? undefined,
      updatedAt: state.updatedAt.getTime(),
    };

    this.cachedState = dto;
    return dto;
  }

  async activate(reason: string, stoppedBy: string): Promise<EmergencyStopDto> {
    const state = await db.emergencyStop.update({
      where: { id: "singleton" },
      data: {
        active: true,
        reason,
        stoppedAt: new Date(),
        stoppedBy,
      },
    });

    const dto: EmergencyStopDto = {
      active: state.active,
      reason: state.reason ?? undefined,
      stoppedAt: state.stoppedAt?.getTime() ?? undefined,
      stoppedBy: state.stoppedBy ?? undefined,
      updatedAt: state.updatedAt.getTime(),
    };

    this.cachedState = dto;

    // Publish event for SSE subscribers
    const eventData: EmergencyStopEvent = {
      active: true,
      reason: state.reason ?? undefined,
      stoppedBy: state.stoppedBy ?? undefined,
      stoppedAt: state.stoppedAt?.getTime() ?? undefined,
    };

    eventBus.publish({
      type: "emergency_stop",
      data: eventData,
    });

    console.log(`[EmergencyStop] ACTIVATED by ${stoppedBy}: ${reason}`);

    return dto;
  }

  async deactivate(activatedBy: string): Promise<EmergencyStopDto> {
    const state = await db.emergencyStop.update({
      where: { id: "singleton" },
      data: {
        active: false,
        reason: null,
        stoppedBy: null,
        stoppedAt: null,
      },
    });

    const dto: EmergencyStopDto = {
      active: state.active,
      reason: state.reason ?? undefined,
      stoppedAt: state.stoppedAt?.getTime() ?? undefined,
      stoppedBy: state.stoppedBy ?? undefined,
      updatedAt: state.updatedAt.getTime(),
    };

    this.cachedState = dto;

    // Publish event for SSE subscribers
    const eventData: EmergencyStopEvent = {
      active: false,
      stoppedBy: activatedBy,
    };

    eventBus.publish({
      type: "emergency_stop",
      data: eventData,
    });

    console.log(`[EmergencyStop] DEACTIVATED by ${activatedBy}`);

    return dto;
  }

  async update(input: EmergencyStopInput, updatedBy: string): Promise<EmergencyStopDto> {
    if (input.active) {
      return await this.activate(input.reason ?? "Manual activation", updatedBy);
    } else {
      return await this.deactivate(updatedBy);
    }
  }

  async resetToDefaults(): Promise<void> {
    await db.emergencyStop.update({
      where: { id: "singleton" },
      data: {
        active: false,
        reason: null,
        stoppedBy: null,
        stoppedAt: null,
      },
    });

    this.cachedState = {
      active: false,
      updatedAt: Date.now(),
    };

    console.log(`[EmergencyStop] Reset to defaults`);
  }

  isStopped(): boolean {
    // Use cached state for fast checks
    return this.cachedState?.active ?? false;
  }
}

export const emergencyStopService = EmergencyStopService.getInstance();