import { Colors } from '@blueprintjs/core';
import { Helmet } from 'react-helmet';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import {
    BrowserRouter as Router,
    Redirect,
    Route,
    Switch,
} from 'react-router-dom';
import './App.css';
import AppStyle from './App.styles';
import AppRoute from './components/AppRoute';
import ForbiddenPanel from './components/ForbiddenPanel';
import { Intercom } from './components/Intercom';
import JobDetailsDrawer from './components/JobDetailsDrawer';
import MobileView from './components/Mobile';
import NavBar from './components/NavBar';
import PrivateRoute from './components/PrivateRoute';
import ProjectRoute from './components/ProjectRoute';
import UserCompletionModal from './components/UserCompletionModal';
import CreateProject from './pages/CreateProject';
import CreateProjectSettings from './pages/CreateProjectSettings';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import Home from './pages/Home';
import Login from './pages/Login';
import PasswordRecovery from './pages/PasswordRecovery';
import PasswordReset from './pages/PasswordReset';
import { Projects } from './pages/Projects';
import Register from './pages/Register';
import SavedDashboards from './pages/SavedDashboards';
import SavedExplorer from './pages/SavedExplorer';
import SavedQueries from './pages/SavedQueries';
import Settings from './pages/Settings';
import ShareRedirect from './pages/ShareRedirect';
import Signup from './pages/Signup';
import Space from './pages/Space';
import Spaces from './pages/Spaces';
import SqlRunner from './pages/SqlRunner';
import UserActivity from './pages/UserActivity';
import { AppProvider } from './providers/AppProvider';
import { BlueprintProvider } from './providers/BlueprintProvider';
import { DashboardProvider } from './providers/DashboardProvider';
import { TrackingProvider, TrackPage } from './providers/TrackingProvider';
import { PageName } from './types/Events';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            onError: async (result) => {
                // @ts-ignore
                const { error: { statusCode } = {} } = result;
                if (statusCode === 401) {
                    await queryClient.invalidateQueries('health');
                }
            },
        },
    },
});

const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
    ) || window.innerWidth < 768;

const App = () => (
    <>
        <Helmet>
            <title>Lightdash</title>
        </Helmet>
        <AppStyle />
        <QueryClientProvider client={queryClient}>
            <BlueprintProvider>
                <AppProvider>
                    <TrackingProvider>
                        {isMobile ? (
                            <MobileView />
                        ) : (
                            <Router>
                                <Intercom />
                                <Switch>
                                    <Route path="/register">
                                        <TrackPage name={PageName.REGISTER}>
                                            <Register />
                                        </TrackPage>
                                    </Route>
                                    <Route path="/login">
                                        <TrackPage name={PageName.LOGIN}>
                                            <Login />
                                        </TrackPage>
                                    </Route>
                                    <Route path="/recover-password">
                                        <TrackPage
                                            name={PageName.PASSWORD_RECOVERY}
                                        >
                                            <PasswordRecovery />
                                        </TrackPage>
                                    </Route>
                                    <Route path="/reset-password/:code">
                                        <TrackPage
                                            name={PageName.PASSWORD_RESET}
                                        >
                                            <PasswordReset />
                                        </TrackPage>
                                    </Route>
                                    <Route path="/invite/:inviteCode">
                                        <TrackPage name={PageName.SIGNUP}>
                                            <Signup />
                                        </TrackPage>
                                    </Route>
                                    <PrivateRoute path="/">
                                        <div
                                            style={{
                                                minHeight: '100vh',
                                                background: Colors.LIGHT_GRAY5,
                                            }}
                                        >
                                            <UserCompletionModal />

                                            <Switch>
                                                <Route path="/createProject/:method?">
                                                    <NavBar />
                                                    <TrackPage
                                                        name={
                                                            PageName.CREATE_PROJECT
                                                        }
                                                    >
                                                        <CreateProject />
                                                    </TrackPage>
                                                </Route>
                                                <Route path="/createProjectSettings/:projectUuid">
                                                    <NavBar />
                                                    <TrackPage
                                                        name={
                                                            PageName.CREATE_PROJECT_SETTINGS
                                                        }
                                                    >
                                                        <CreateProjectSettings />
                                                    </TrackPage>
                                                </Route>
                                                <Route path="/generalSettings/:tab?">
                                                    <NavBar />
                                                    <TrackPage
                                                        name={
                                                            PageName.GENERAL_SETTINGS
                                                        }
                                                    >
                                                        <Settings />
                                                    </TrackPage>
                                                </Route>
                                                <Route path="/no-access">
                                                    <NavBar />
                                                    <TrackPage
                                                        name={
                                                            PageName.NO_ACCESS
                                                        }
                                                    >
                                                        <ForbiddenPanel />
                                                    </TrackPage>
                                                </Route>
                                                <Route path="/no-project-access">
                                                    <NavBar />
                                                    <TrackPage
                                                        name={
                                                            PageName.NO_PROJECT_ACCESS
                                                        }
                                                    >
                                                        <ForbiddenPanel subject="project" />
                                                    </TrackPage>
                                                </Route>
                                                <Route path="/share/:shareNanoid">
                                                    <NavBar />
                                                    <TrackPage
                                                        name={PageName.SHARE}
                                                    >
                                                        <ShareRedirect />
                                                    </TrackPage>
                                                </Route>
                                                <AppRoute path="/">
                                                    <Switch>
                                                        <ProjectRoute path="/projects/:projectUuid">
                                                            <Switch>
                                                                <Route path="/projects/:projectUuid/saved/:savedQueryUuid/:mode?">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.SAVED_QUERY_EXPLORER
                                                                        }
                                                                    >
                                                                        <SavedExplorer />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route path="/projects/:projectUuid/saved">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.SAVED_QUERIES
                                                                        }
                                                                    >
                                                                        <SavedQueries />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route path="/projects/:projectUuid/dashboards/:dashboardUuid/:mode?">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.DASHBOARD
                                                                        }
                                                                    >
                                                                        <DashboardProvider>
                                                                            <Dashboard />
                                                                        </DashboardProvider>
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route path="/projects/:projectUuid/dashboards">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.SAVED_DASHBOARDS
                                                                        }
                                                                    >
                                                                        <SavedDashboards />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route path="/projects/:projectUuid/sqlRunner">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.SQL_RUNNER
                                                                        }
                                                                    >
                                                                        <SqlRunner />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route path="/projects/:projectUuid/tables/:tableId">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.EXPLORER
                                                                        }
                                                                    >
                                                                        <Explorer />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route path="/projects/:projectUuid/tables">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.EXPLORE_TABLES
                                                                        }
                                                                    >
                                                                        <Explorer />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route path="/projects/:projectUuid/spaces/:spaceUuid">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.SPACE
                                                                        }
                                                                    >
                                                                        <Space />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route path="/projects/:projectUuid/spaces">
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.SPACES
                                                                        }
                                                                    >
                                                                        <Spaces />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route
                                                                    path="/projects/:projectUuid/home"
                                                                    exact
                                                                >
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.HOME
                                                                        }
                                                                    >
                                                                        <Home />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Route
                                                                    path="/projects/:projectUuid/user-activity"
                                                                    exact
                                                                >
                                                                    <NavBar />
                                                                    <TrackPage
                                                                        name={
                                                                            PageName.USER_ACTIVITY
                                                                        }
                                                                    >
                                                                        <UserActivity />
                                                                    </TrackPage>
                                                                </Route>
                                                                <Redirect to="/projects" />
                                                            </Switch>
                                                        </ProjectRoute>
                                                        <Route
                                                            path="/projects/:projectUuid?"
                                                            exact
                                                        >
                                                            <Projects />
                                                        </Route>
                                                        <Redirect to="/projects" />
                                                    </Switch>
                                                </AppRoute>
                                            </Switch>
                                        </div>
                                    </PrivateRoute>
                                </Switch>
                                <JobDetailsDrawer />
                            </Router>
                        )}
                    </TrackingProvider>
                </AppProvider>
            </BlueprintProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    </>
);

export default App;
