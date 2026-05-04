import { AgentRulesEditor } from "@/components/config/AgentRulesEditor";
import { CareerStoriesEditor } from "@/components/config/CareerStoriesEditor";
import { CompaniesEditor } from "@/components/config/CompaniesEditor";
import { CompensationEditor } from "@/components/config/CompensationEditor";
import { NotebookSessionManager } from "@/components/config/NotebookSessionManager";
import { PromptEditor } from "@/components/config/PromptEditor";
import { ResumeBulletsEditor } from "@/components/config/ResumeBulletsEditor";
import { ScoringRubricsEditor } from "@/components/config/ScoringRubricsEditor";
import { TemplateIdsEditor } from "@/components/config/TemplateIdsEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryParam } from "@/hooks/use-query-param";

/**
 * Full config page content rendered as a single React island.
 *
 * Previously Tabs/TabsTrigger/TabsContent were split across Astro and React,
 * causing SSR to crash with "Tabs components must be rendered inside <Tabs />"
 * because React Context from <Tabs> wasn't available to its children during
 * server-side rendering.
 */
export function ConfigTabs() {
  const [tab, setTab] = useQueryParam("tab", "prompts");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="prompts">Prompts &amp; Context</TabsTrigger>
        <TabsTrigger value="resume">Resume Data</TabsTrigger>
        <TabsTrigger value="agent">Agent Settings</TabsTrigger>
        <TabsTrigger value="rubrics">Scoring Rubrics</TabsTrigger>
        <TabsTrigger value="templates">Doc Templates</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
      </TabsList>

      <TabsContent value="prompts" className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <PromptEditor />
          <div className="space-y-5">
            <CompensationEditor />
            <CareerStoriesEditor />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="resume" className="space-y-5">
        <ResumeBulletsEditor />
      </TabsContent>

      <TabsContent value="agent" className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <AgentRulesEditor />
          <TemplateIdsEditor />
        </div>
      </TabsContent>

      <TabsContent value="templates" className="space-y-5">
        <CompaniesEditor />
      </TabsContent>

      <TabsContent value="rubrics" className="space-y-5">
        <ScoringRubricsEditor />
      </TabsContent>

      <TabsContent value="sessions" className="space-y-5">
        <NotebookSessionManager />
      </TabsContent>
    </Tabs>
  );
}
