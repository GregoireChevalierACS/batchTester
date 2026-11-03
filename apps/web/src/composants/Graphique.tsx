import type { EChartsOption } from 'echarts';
import { useCallback, useEffect, useRef } from 'react';
import { creerUnGraphique } from '../echarts.ts';

interface Proprietes {
  readonly titre: string;
  readonly option: EChartsOption;
  readonly hauteur?: number;
}

type Instance = ReturnType<typeof creerUnGraphique>;

export function Graphique({ titre, option, hauteur = 240 }: Proprietes) {
  const instance = useRef<Instance | null>(null);

  // Ref avec nettoyage (React 19) : le graphique vit exactement aussi longtemps que son conteneur.
  const attacher = useCallback((element: HTMLDivElement) => {
    const graphique = creerUnGraphique(element);
    instance.current = graphique;
    const observateur = new ResizeObserver(() => {
      graphique.resize();
    });
    observateur.observe(element);
    return () => {
      observateur.disconnect();
      graphique.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    instance.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <figure className="graphique">
      <figcaption>{titre}</figcaption>
      <div ref={attacher} role="img" aria-label={titre} style={{ height: hauteur }} />
    </figure>
  );
}
