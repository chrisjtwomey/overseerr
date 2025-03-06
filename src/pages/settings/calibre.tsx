import SettingsCalibre from '@app/components/Settings/SettingsCalibre';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const CalibreSettingsPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsCalibre />
    </SettingsLayout>
  );
};

export default CalibreSettingsPage;
