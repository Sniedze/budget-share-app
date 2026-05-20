import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { GET_USER_WORKSPACE_SETTINGS, SAVE_USER_WORKSPACE_SETTINGS } from './graphql';
import { mapWorkspaceSettingsFromApi, type UserWorkspaceSettingsData } from './mappers';
import {
  buildMigrateLocalWorkspaceInput,
  clearLocalWorkspaceStorage,
  isWorkspaceSettingsEmpty,
  readLocalWorkspaceSnapshot,
} from './migrateLocalStorage';
import { toGraphqlSaveInput, type SaveUserWorkspaceSettingsInput } from './saveInput';

type WorkspaceSettingsResponse = Parameters<typeof mapWorkspaceSettingsFromApi>[0];

type GetUserWorkspaceSettingsData = {
  userWorkspaceSettings: WorkspaceSettingsResponse;
};

type SaveUserWorkspaceSettingsData = {
  saveUserWorkspaceSettings: WorkspaceSettingsResponse;
};

export const useUserWorkspaceSettings = (userId: string, yearMonth: string) => {
  const migratedRef = useRef(false);
  const skip = !userId;

  const { data, loading, refetch } = useQuery<GetUserWorkspaceSettingsData>(GET_USER_WORKSPACE_SETTINGS, {
    variables: { yearMonth },
    skip,
    fetchPolicy: 'network-only',
  });

  const [saveMutation] = useMutation<SaveUserWorkspaceSettingsData>(SAVE_USER_WORKSPACE_SETTINGS);

  const settings = useMemo((): UserWorkspaceSettingsData | null => {
    if (!data?.userWorkspaceSettings) {
      return null;
    }
    return mapWorkspaceSettingsFromApi(data.userWorkspaceSettings);
  }, [data]);

  const saveSettings = useCallback(
    async (patch: SaveUserWorkspaceSettingsInput) => {
      if (!userId) {
        return null;
      }
      const result = await saveMutation({
        variables: { input: toGraphqlSaveInput(patch) },
        refetchQueries: [{ query: GET_USER_WORKSPACE_SETTINGS, variables: { yearMonth } }],
        awaitRefetchQueries: true,
      });
      const saved = result.data?.saveUserWorkspaceSettings;
      return saved ? mapWorkspaceSettingsFromApi(saved) : null;
    },
    [saveMutation, userId, yearMonth],
  );

  useEffect(() => {
    if (skip || loading || !settings || migratedRef.current) {
      return;
    }
    if (!isWorkspaceSettingsEmpty(settings)) {
      migratedRef.current = true;
      return;
    }
    const snapshot = readLocalWorkspaceSnapshot(userId, yearMonth);
    if (isWorkspaceSettingsEmpty(snapshot)) {
      migratedRef.current = true;
      return;
    }
    migratedRef.current = true;
    void (async () => {
      await saveMutation({
        variables: { input: toGraphqlSaveInput(buildMigrateLocalWorkspaceInput(snapshot, yearMonth)) },
      });
      clearLocalWorkspaceStorage(userId, yearMonth);
      await refetch();
    })();
  }, [loading, refetch, saveMutation, settings, skip, userId, yearMonth]);

  return {
    settings,
    loading: skip ? false : loading,
    saveSettings,
    refetch,
  };
};
