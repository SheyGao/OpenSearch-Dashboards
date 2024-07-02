import { getSavedVisBuilderLoader } from '../../../plugin_services';
import { getStateFromSavedObject } from '../../../saved_visualizations/transforms';

const migrateVisualization = async (visualizationId: string): Promise<any> => {
  try {
    const savedVisBuilderLoader = getSavedVisBuilderLoader();
    const savedVisBuilderVis = await savedVisBuilderLoader.get(visualizationId) as any;

    if (savedVisBuilderVis.id) {
      // Extract the state from the saved object
      const { state, title, description, searchSourceFields } = getStateFromSavedObject(savedVisBuilderVis.attributes);
      const version = savedVisBuilderVis.attributes.version || 1;
      const references = savedVisBuilderVis.references || [];
      const kibanaSavedObjectMeta = savedVisBuilderVis.attributes.kibanaSavedObjectMeta || {};

      // Map the state to the new structure
      const migratedState = {
        title,
        description,
        version,
        kibanaSavedObjectMeta,
        references,
        visualizationState: state.visualization,
        uiState: state.ui,
        searchSourceFields,
        state: {
          ui: state.ui,
          style: state.style,
          visualization: state.visualization,
        },
      };

      return migratedState;
    } else {
      throw new Error('Saved visualization not found');
    }
  } catch (error) {
    console.error('Failed to migrate visualization:', error);
    return undefined;
  }
};

export { migrateVisualization };
