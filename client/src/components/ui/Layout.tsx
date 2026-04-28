import styled from 'styled-components';
import {
 colors, radii, spacing 
} from '../../styles/tokens';

export const AppLayout = styled.main`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  background: ${colors.background};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const PageSurface = styled.section`
  margin: ${spacing.xxl};
  padding: ${spacing.xxl};
  background: ${colors.surface};
  border-radius: ${radii.lg};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
`;

export const HeaderRow = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${spacing.lg};
  margin-bottom: ${spacing.xl};
`;

export const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
`;
