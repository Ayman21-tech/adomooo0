import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { GamificationProvider } from "@/contexts/GamificationContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";

const Website = lazy(() => import("./pages/Website"));
const SignIn = lazy(() => import("./pages/SignIn"));
const ClassSelection = lazy(() => import("./pages/ClassSelection"));
const SchoolName = lazy(() => import("./pages/SchoolName"));
const SubjectsSelection = lazy(() => import("./pages/SubjectsSelection"));
const Home = lazy(() => import("./pages/Home"));
const Subject = lazy(() => import("./pages/Subject"));
const ExamPrepPage = lazy(() => import("./pages/ExamPrepPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TeacherOnboarding = lazy(() => import("./pages/teacher/TeacherOnboarding"));
const TeacherLayout = lazy(() => import("./pages/teacher/TeacherLayout"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <AccessibilityProvider>
        <GamificationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense
                fallback={
                  <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Website />} />
                  <Route path="/signin" element={<SignIn />} />
                  <Route path="/onboarding/class" element={<ClassSelection />} />
                  <Route path="/onboarding/school" element={<SchoolName />} />
                  <Route path="/onboarding/subjects" element={<SubjectsSelection />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/subject/:id" element={<Subject />} />
                  {/* Preparation / Exam Pages */}
                  <Route path="/prep/:prepType" element={<ExamPrepPage />} />
                  <Route path="/exam/:prepType" element={<ExamPrepPage />} />
                  {/* Teacher Mode */}
                  <Route path="/teacher/onboarding" element={<TeacherOnboarding />} />
                  <Route path="/teacher/dashboard" element={<TeacherLayout />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </GamificationProvider>
      </AccessibilityProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
