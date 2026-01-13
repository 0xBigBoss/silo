export interface SiloConfig {
  version: 1;
  prefix?: string;
  output?: string;
  ports: Record<string, number>;
  hosts?: Record<string, string>;
  urls?: Record<string, string>;
  k3d?: K3dConfig;
  hooks?: LifecycleHooks;
}

export interface K3dConfig {
  enabled: boolean;
  args?: string[];
  registry?: {
    enabled: boolean;
  };
}

export interface LifecycleHooks {
  "pre-up"?: string[];
  "post-up"?: string[];
  "pre-down"?: string[];
  "post-down"?: string[];
}

export interface ResolvedConfig {
  version: 1;
  prefix: string;
  output: string;
  ports: Record<string, number>;
  portOrder: string[];
  hosts: Record<string, string>;
  hostOrder: string[];
  urls: Record<string, string>;
  urlOrder: string[];
  k3d: K3dConfig | undefined;
  hooks: LifecycleHooks;
  configPath: string;
  projectRoot: string;
}

export interface InstanceIdentity {
  name: string;
  prefix: string;
  composeName: string;
  dockerNetwork: string;
  volumePrefix: string;
  containerPrefix: string;
  hosts: Record<string, string>;
  k3dClusterName?: string | undefined;
  k3dRegistryName?: string | undefined;
  kubeconfigPath?: string | undefined;
}

export interface InstanceState {
  name: string;
  ports: Record<string, number>;
  identity: InstanceIdentity;
  createdAt: string;
  k3dClusterCreated: boolean;
  tiltPid?: number | undefined;
  tiltStartedAt?: string | undefined;
}

export interface Lockfile {
  version: 1;
  generatedAt: string;
  instance: InstanceState;
}

export type IdentityVars = Record<string, string> & {
  name: string;
  prefix: string;
  WORKSPACE_NAME: string;
  COMPOSE_PROJECT_NAME: string;
};
