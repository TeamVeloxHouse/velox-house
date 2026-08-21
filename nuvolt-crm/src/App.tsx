import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
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
import { Projects } from './pages/Projects'
import { Campaigns } from './pages/Campaigns'
import { Automation } from './pages/Automation'
import { Documents } from './pages/Documents'
import { Settings } from './pages/Settings'
import { SimplrAI } from './pages/SimplrAI'
import { Meetings } from './pages/Meetings'
import { Agents } from './pages/Agents'
import { Prospector } from './pages/Prospector'
import { LinkedInInbox } from './pages/LinkedInInbox'
import { ReachOverview, Finders, SolarFinder, Outreach, ReachAnalytics, ReachCampaigns, ReachSchedules, ReachAI } from './pages/reach'
import { DesignStudio } from './pages/DesignStudio'
import { Proposal } from './pages/Proposal'
import { StudioOverview, ProposalsList, StudioAnalytics, StudioTemplates } from './pages/studio'
import { StudioPricing } from './pages/StudioPricing'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'ai', element: <SimplrAI /> },
      { path: 'agents', element: <Agents /> },
      { path: 'meetings', element: <Meetings /> },
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
      { path: 'projects', element: <Projects /> },
      { path: 'campaigns', element: <Campaigns /> },
      { path: 'automation', element: <Automation /> },
      { path: 'documents', element: <Documents /> },
      { path: 'settings', element: <Settings /> },
      // Simplr Reach — prospecting & outreach workspace
      { path: 'reach', element: <ReachOverview /> },
      { path: 'reach/ai', element: <ReachAI /> },
      { path: 'reach/finders', element: <Finders /> },
      { path: 'reach/solar', element: <SolarFinder /> },
      // Simplr Studio — design, proposals & analytics
      { path: 'studio', element: <StudioOverview /> },
      { path: 'studio/design', element: <DesignStudio /> },
      { path: 'studio/proposal/:id', element: <Proposal /> },
      { path: 'studio/proposals', element: <ProposalsList /> },
      { path: 'studio/analytics', element: <StudioAnalytics /> },
      { path: 'studio/pricing', element: <StudioPricing /> },
      { path: 'studio/templates', element: <StudioTemplates /> },
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
