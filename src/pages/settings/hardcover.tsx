import SettingsHardcover from '@app/components/Settings/SettingsHardcover';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const HardcoverSettingsPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsHardcover />
    </SettingsLayout>
  );
};

export default HardcoverSettingsPage;
