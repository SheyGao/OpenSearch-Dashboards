import { useEffect, useState } from 'react';
import { SavedObject } from '../../../../../saved_objects/public';
import {
  InvalidJSONProperty,
  redirectWhenMissing,
  SavedObjectNotFound,
} from '../../../../../opensearch_dashboards_utils/public';
import { EDIT_PATH, PLUGIN_ID } from '../../../../common';
import { VisBuilderServices } from '../../../types';
import { getCreateBreadcrumbs, getEditBreadcrumbs } from '../breadcrumbs';
import {
  useTypedDispatch,
  setStyleState,
  setVisualizationState,
  setUIStateState,
} from '../state_management';
import { useOpenSearchDashboards } from '../../../../../opensearch_dashboards_react/public';
import { getStateFromSavedObject } from '../../../saved_visualizations/transforms';
import { migrateVisualization } from '../state_management/migration_func';
import { setEditorState } from '../state_management/metadata_slice';

export const useSavedVisBuilderVis = (visualizationIdFromUrl: string | undefined) => {
  const { services } = useOpenSearchDashboards<VisBuilderServices>();
  const [savedVisState, setSavedVisState] = useState<SavedObject | undefined>(undefined);
  const dispatch = useTypedDispatch();

  const visualizationTypes = ['bar', 'line', 'area', 'metric', 'table'];

  useEffect(() => {
    const {
      application: { navigateToApp },
      chrome,
      data,
      history,
      http: { basePath },
      toastNotifications,
      savedVisBuilderLoader,
    } = services;

    const loadSavedVisBuilderVis = async () => {
      try {
        dispatch(setEditorState({ state: 'loading' }));
        const savedVisBuilderVis = await getSavedVisBuilderVis(savedVisBuilderLoader, visualizationIdFromUrl) as any;

        if (savedVisBuilderVis.id) {
          const urlParams = new URLSearchParams(window.location.search);
          const visTypeFromUrl = urlParams.get('type');
          const visType = visTypeFromUrl || savedVisBuilderVis.attributes?.type;
          const needsMigration = visualizationTypes.includes(visType || '');

          let state;
          let title;
          if (needsMigration) {
            const migratedState = await migrateVisualization(savedVisBuilderVis.id);
            state = migratedState?.state;
            title = migratedState?.title;
          } else {
            const extractedState = getStateFromSavedObject(savedVisBuilderVis.attributes);
            state = extractedState.state;
            title = extractedState.title;
          }

          if (state && title) {
            chrome.setBreadcrumbs(getEditBreadcrumbs(title, navigateToApp));
            chrome.docTitle.change(title);

            setFiltersAndQuery(data, savedVisBuilderVis);
            dispatch(setUIStateState(state.ui));
            dispatch(setStyleState(state.style));
            dispatch(setVisualizationState(state.visualization));
            dispatch(setEditorState({ state: 'loaded' }));

            setSavedVisState(savedVisBuilderVis);
            dispatch(setEditorState({ state: 'clean' }));
          }
        } else {
          chrome.setBreadcrumbs(getCreateBreadcrumbs(navigateToApp));
        }
      } catch (error) {
        handleErrors(error, history, navigateToApp, toastNotifications, basePath, visualizationIdFromUrl);
      }
    };

    loadSavedVisBuilderVis();
  }, [dispatch, services, visualizationIdFromUrl]);

  return savedVisState;
};

const setFiltersAndQuery = (data: any, savedVisBuilderVis: any) => {
  const filters = savedVisBuilderVis.searchSourceFields.filter;
  const query = savedVisBuilderVis.searchSourceFields.query || data.query.queryString.getDefaultQuery();
  const actualFilters: any[] = [];
  const tempFilters = typeof filters === 'function' ? filters() : filters;
  (Array.isArray(tempFilters) ? tempFilters : [tempFilters]).forEach((filter: any) => {
    if (filter) actualFilters.push(filter);
  });
  data.query.filterManager.setAppFilters(actualFilters);
  data.query.queryString.setQuery(query);
};

const handleErrors = (error: any, history: any, navigateToApp: any, toastNotifications: any, basePath: any, visualizationIdFromUrl: any) => {
  const managementRedirectTarget = {
    [PLUGIN_ID]: {
      app: 'management',
      path: `opensearch-dashboards/objects/savedVisBuilder/${visualizationIdFromUrl}`,
    },
  };

  try {
    if (error instanceof SavedObjectNotFound) {
      redirectWhenMissing({
        history,
        navigateToApp,
        toastNotifications,
        basePath,
        mapping: managementRedirectTarget,
      })(error);
    }
    if (error instanceof InvalidJSONProperty) {
      toastNotifications.addDanger(error.message);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    toastNotifications.addDanger(message);
    history.replace(EDIT_PATH);
  }
};

async function getSavedVisBuilderVis(savedVisBuilderLoader: VisBuilderServices['savedVisBuilderLoader'], visBuilderVisId?: string) {
  return await savedVisBuilderLoader.get(visBuilderVisId) as any; // Cast to any to allow dynamic type checking
}
