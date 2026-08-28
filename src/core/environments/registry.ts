import type { Environment, EnvironmentDefinition } from './Environment'
import { gridWorldDefinition } from './gridworld/GridWorldEnv'

const registry = new Map<string, EnvironmentDefinition>()

export function registerEnvironment(definition: EnvironmentDefinition): void {
  registry.set(definition.id, definition)
}

export function getEnvironmentDefinition(id: string): EnvironmentDefinition {
  const definition = registry.get(id)
  if (!definition) {
    throw new Error(`Unknown environment id: "${id}"`)
  }
  return definition
}

export function createEnvironment(id: string, config?: unknown): Environment {
  const definition = getEnvironmentDefinition(id)
  return definition.create(config ?? definition.createDefaultConfig())
}

export function listEnvironmentDefinitions(): EnvironmentDefinition[] {
  return Array.from(registry.values())
}

registerEnvironment(gridWorldDefinition)
