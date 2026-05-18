import { useState, useMemo } from 'react';
import locationsData from '../data/locations.json';
import nodesData from '../data/nodes.json';
import edgesData from '../data/edges.json';
import type { BarrierFreeData, Facilities } from '../types';

const data = {
  locations: locationsData.locations,
  routeGraph: {
    nodes: nodesData.nodes,
    edges: edgesData.edges,
  },
} as unknown as BarrierFreeData;

export const useBarrierFreeData = () => {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const filteredLocations = useMemo(() => {
    return data.locations.filter((location) =>
      activeFilters.every((filter) => {
        const facility = location.facilities[filter as keyof Facilities];
        return facility?.exists;
      })
    );
  }, [activeFilters]);

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  };

  return {
    filteredLocations,
    activeFilters,
    toggleFilter,
    defaultNodes: data.routeGraph.nodes,
    defaultEdges: data.routeGraph.edges,
  };
};
