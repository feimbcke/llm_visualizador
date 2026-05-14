import { ModuleChat } from '../components/ModuleChat';
import { VisualizationPlaceholder } from '../components/VisualizationPlaceholder';
import type { ModuleProps } from './registry';

export function DefaultModule({ tab, module }: ModuleProps) {
  return (
    <>
      <div className={tab === 'chat' ? 'block' : 'hidden lg:block'}>
        <ModuleChat moduleId={module.id} promptHint={module.promptHint} />
      </div>
      <div className={tab === 'viz' ? 'block' : 'hidden lg:block'}>
        <VisualizationPlaceholder module={module} />
      </div>
    </>
  );
}
