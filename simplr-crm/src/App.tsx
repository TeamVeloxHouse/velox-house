import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { MyTasks } from './pages/MyTasks'
import { DealsBoard } from './pages/DealsBoard'
import { DealDetail } from './pages/DealDetail'
import { Leads } from './pages/Leads'
import { People } from './pages/People'
import { PersonDetail } from './pages/PersonDetail'
import { Organisations } from './pages/Organisations'
import { Activities } from './pages/Activities'
import { Inbox } from './pages/Inbox'
import { Insights } from './pages/Insights'
import { Forecast } from './pages/Forecast'
import { Products } from './pages/Products'
import { Jobs } from './pages/Jobs'
import { Projects } from './pages/Projects'
import { Campaigns } from './pages/Campaigns'
import { Automation } from './pages/Automation'
import { Documents } from './pages/Documents'
import { Settings } from './pages/Settings'
import { TellOviAI } from './pages/TellOviAI'
import { Meetings } from './pages/Meetings'
import { LiveMeeting } from './pages/LiveMeeting'
import { Calendar } from './pages/Calendar'
import { Agents } from './pages/Agents'
import { Prospector } from './pages/Prospector'
import { LinkedInInbox } from './pages/LinkedInInbox'
import { ReachOverview, Finders, SolarFinder, Outreach, ReachAnalytics, ReachCampaigns, ReachSchedules, ReachAI } from './pages/reach'
import { DesignStudio } from './pages/DesignStudio'
import { Proposal } from './pages/Proposal'
import { StudioOverview, ProposalsList, StudioAnalytics, StudioTemplates } from './pages/studio'
import { StudioPricing } from './pages/StudioPricing'
import { Delivery, ProjectDetail } from './pages/Delivery'
import { EvCalculator } from './pages/EvCalculator'
import { PeopleFinder } from './pages/PeopleFinder'
import { BrandDocuments } from './pages/BrandDocuments'
import { Team } from './pages/Team'
import { Operations, Finance, HR, DeliveryDept } from './pages/departments'
import {
  FinanceInvoices, FinanceExpenses, FinanceForecasting, FinanceReports,
  OpsSchedule, OpsStock, OpsPurchaseOrders, OpsSafety,
  HrPeople, HrLeave, HrPolicies, HrCompliance,
  MktReviews, MktCampaigns, MktReports,
  DelInstalls, DelField, DelCertificates, DelService,
} from './pages/deptPages'
import { MarketingOverview, BrandHub, MarketingAssets, ContentPlanner, MarketingSocial, MarketingRequests, MarketingConnectors } from './pages/marketing'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'tasks', element: <MyTasks /> },
      { path: 'ai', element: <TellOviAI /> },
      { path: 'team', element: <Team /> },
      { path: 'operations', element: <Operations /> },
      { path: 'operations/schedule', element: <OpsSchedule /> },
      { path: 'operations/stock', element: <OpsStock /> },
      { path: 'operations/purchase-orders', element: <OpsPurchaseOrders /> },
      { path: 'operations/safety', element: <OpsSafety /> },
      { path: 'finance', element: <Finance /> },
      { path: 'finance/invoices', element: <FinanceInvoices /> },
      { path: 'finance/expenses', element: <FinanceExpenses /> },
      { path: 'finance/forecasting', element: <FinanceForecasting /> },
      { path: 'finance/reports', element: <FinanceReports /> },
      { path: 'hr', element: <HR /> },
      { path: 'hr/people', element: <HrPeople /> },
      { path: 'hr/leave', element: <HrLeave /> },
      { path: 'hr/policies', element: <HrPolicies /> },
      { path: 'hr/compliance', element: <HrCompliance /> },
      { path: 'marketing', element: <MarketingOverview /> },
      { path: 'marketing/brand', element: <BrandHub /> },
      { path: 'marketing/assets', element: <MarketingAssets /> },
      { path: 'marketing/content', element: <ContentPlanner /> },
      { path: 'marketing/campaigns', element: <MktCampaigns /> },
      { path: 'marketing/social', element: <MarketingSocial /> },
      { path: 'marketing/reviews', element: <MktReviews /> },
      { path: 'marketing/requests', element: <MarketingRequests /> },
      { path: 'marketing/connectors', element: <MarketingConnectors /> },
      { path: 'marketing/reports', element: <MktReports /> },
      { path: 'delivery', element: <DeliveryDept /> },
      { path: 'delivery/installs', element: <DelInstalls /> },
      { path: 'delivery/field', element: <DelField /> },
      { path: 'delivery/certificates', element: <DelCertificates /> },
      { path: 'delivery/service', element: <DelService /> },
      { path: 'agents', element: <Agents /> },
      { path: 'meetings', element: <Meetings /> },
      { path: 'meetings/live', element: <LiveMeeting /> },
      { path: 'calendar', element: <Calendar /> },
      { path: 'deals', element: <DealsBoard /> },
      { path: 'deals/:id', element: <DealDetail /> },
      { path: 'leads', element: <Leads /> },
      { path: 'people', element: <People /> },
      { path: 'people/:id', element: <PersonDetail /> },
      { path: 'organisations', element: <Organisations /> },
      { path: 'activities', element: <Activities /> },
      { path: 'inbox', element: <Inbox /> },
      { path: 'linkedin', element: <LinkedInInbox /> },
      { path: 'insights', element: <Insights /> },
      { path: 'forecast', element: <Forecast /> },
      { path: 'products', element: <Products /> },
      { path: 'jobs', element: <Jobs /> },
      { path: 'projects', element: <Projects /> },
      { path: 'campaigns', element: <Campaigns /> },
      { path: 'automation', element: <Automation /> },
      { path: 'documents', element: <Documents /> },
      { path: 'settings', element: <Settings /> },
      // TellOvi Reach — prospecting & outreach workspace
      { path: 'reach', element: <ReachOverview /> },
      { path: 'reach/ai', element: <ReachAI /> },
      { path: 'reach/finders', element: <Finders /> },
      { path: 'reach/solar', element: <SolarFinder /> },
      { path: 'reach/people-finder', element: <PeopleFinder /> },
      // TellOvi Studio — design, proposals & analytics
      { path: 'studio', element: <StudioOverview /> },
      { path: 'studio/design', element: <DesignStudio /> },
      { path: 'studio/proposal/:id', element: <Proposal /> },
      { path: 'studio/proposals', element: <ProposalsList /> },
      { path: 'studio/analytics', element: <StudioAnalytics /> },
      { path: 'studio/pricing', element: <StudioPricing /> },
      { path: 'studio/ev', element: <EvCalculator /> },
      { path: 'studio/delivery', element: <Delivery /> },
      { path: 'studio/delivery/:id', element: <ProjectDetail /> },
      { path: 'studio/templates', element: <StudioTemplates /> },
      { path: 'studio/brand', element: <BrandDocuments /> },
      { path: 'reach/prospects', element: <Prospector /> },
      { path: 'reach/outreach', element: <Outreach /> },
      { path: 'reach/campaigns', element: <ReachCampaigns /> },
      { path: 'reach/schedules', element: <ReachSchedules /> },
      { path: 'reach/email', element: <Inbox /> },
      { path: 'reach/linkedin', element: <LinkedInInbox /> },
      { path: 'reach/analytics', element: <ReachAnalytics /> },
    ],
  },
])
