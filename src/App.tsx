import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { Header } from './components/Header.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { PeoplePage } from './components/PeoplePage.tsx';
import { TreesPage } from './components/TreesPage.tsx';
import { DuplicateReviewPage } from './components/DuplicateReviewPage.tsx';
import { AuditLogPage } from './components/AuditLogPage.tsx';
import { AboutArchitecturePage } from './components/AboutArchitecturePage.tsx';
import { ActiveView } from './types.ts';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('landing');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const handleSelectPerson = (personId: string) => {
    setSelectedPersonId(personId);
    setActiveView('people');
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#10161C] text-[#EDE7DF] flex flex-col font-sans selection:bg-[#B8873F]/25 selection:text-[#F3ECDD]">
        <Header activeView={activeView} setActiveView={setActiveView} />

        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {activeView === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex-1"
              >
                <LandingPage setActiveView={setActiveView} />
              </motion.div>
            )}

            {activeView === 'people' && (
              <motion.div
                key="people"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex-1"
              >
                <PeoplePage
                  selectedPersonId={selectedPersonId}
                  onClearSelection={() => setSelectedPersonId(null)}
                />
              </motion.div>
            )}

            {activeView === 'trees' && (
              <motion.div
                key="trees"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex-1"
              >
                <TreesPage onSelectPerson={handleSelectPerson} />
              </motion.div>
            )}

            {activeView === 'duplicate_review' && (
              <motion.div
                key="duplicate_review"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex-1"
              >
                <DuplicateReviewPage onSelectPerson={handleSelectPerson} />
              </motion.div>
            )}

            {activeView === 'audit_log' && (
              <motion.div
                key="audit_log"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex-1"
              >
                <AuditLogPage />
              </motion.div>
            )}

            {activeView === 'about' && (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex-1"
              >
                <AboutArchitecturePage />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </AuthProvider>
  );
}
