import { Navigate, Route, Routes } from 'react-router-dom';
import { GroupsPage } from './pages/GroupsPage';
import { HomePage } from './pages/HomePage';
import { ImportPage } from './pages/ImportPage';

const App = (): JSX.Element => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/groups" element={<GroupsPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
