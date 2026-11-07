// ~/.dsh/plugins/dsh-system-pedestal/core.mjs - Microkernel Core Aggregator
export { createKernelBus } from './pedestal/kernel-bus.mjs';
export { createGuiGateway } from './pedestal/gui-gateway.mjs';
export { runOnDemandTests, TEST_CATALOG } from './pedestal/test-runner.mjs';
export { bootstrapPedestal } from './index.mjs';
