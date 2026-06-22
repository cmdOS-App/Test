// import { useState } from 'react';
// import {
//   FaFolder,
//   FaGlobeAmericas,
//   FaLock,
//   FaTags,
//   FaUserSecret,
//   FaStar,
//   FaMoon,
//   FaSun,
//   FaPen,
//   FaTasks,
// } from 'react-icons/fa';
// import { motion, AnimatePresence } from 'framer-motion';
// import VideoPlayer from '../Shared/VideoPlayer';
// import VideoPlaceholder from '../Shared/VideoPlaceholder';
// import { existsSync } from 'fs';
// import path from 'path';

// interface FeatureData {
//   id: number;
//   name: string;
//   description: string;
//   videoSrc: string;
//   icon: React.ReactNode;
// }

// type Props = {
//   onNext: () => void;
// };

// export default function FeatureGuide({ onNext }: Props) {
//   const [activeFeature, setActiveFeature] = useState(0);

//   const features: FeatureData[] = [
//     {
//       id: 0,
//       name: 'Share Folders with Team',
//       description: 'Share entire folders with your organization members. Control who can view, edit, or delete notes.',
//       videoSrc: 'videos/Share_Folders_with_Team.mp4',
//       icon: <FaFolder className="text-xl" />,
//     },
//     {
//       id: 1,
//       name: 'Global & Secure Notes',
//       description: 'Share data openly using public links, or keep it private with password-protected access.',
//       videoSrc: 'videos/Global_and_Secure_Sharing.mp4',
//       icon: <FaGlobeAmericas className="text-xl" />,
//     },
//     {
//       id: 2,
//       name: 'Add Multiple Links',
//       description: 'Quickly add multiple links from your open tabs. Organize and access them easily.',
//       videoSrc: 'videos/Add_Multiple_Links.mp4',
//       icon: <FaTags className="text-xl" />,
//     },
//     {
//       id: 3,
//       name: 'To-Dos',
//       description: 'Stay on track by saving tasks, setting goals, and letting to-dos repeat for you!',
//       videoSrc: 'videos/Todos.mp4',
//       icon: <FaTasks className="text-xl" />,
//     },
//   ];

//   const currentFeature = features[activeFeature];

//   // Function to check if a video file actually exists (for client-side only)
//   const checkVideoExists = async (src: string): Promise<boolean> => {
//     try {
//       const response = await fetch(src, { method: 'HEAD' });
//       return response.ok;
//     } catch (error) {
//       return false;
//     }
//   };

//   const [videoExists, setVideoExists] = useState<boolean | null>(null);

//   // In a real implementation, you would check if files exist server-side
//   // Here we'll assume placeholder videos for this example

//   return (
//     <div className="min-h-screen bg-neutral-900 transition-colors duration-300">
//       <div className="max-w-6xl mx-auto px-4 py-12">
//         <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-gray-200 to-gray-300">
//           Getting Started
//         </h1>
//         <div className="flex flex-col md:flex-row gap-8 items-start">
//           {/* Left sidebar with feature buttons */}
//           <div className="w-full md:w-2/5">
//             <div className="space-y-3">
//               {features.map(feature => (
//                 <FeatureButton
//                   key={feature.id}
//                   feature={feature}
//                   active={activeFeature === feature.id}
//                   onClick={() => setActiveFeature(feature.id)}
//                 />
//               ))}
//             </div>
//           </div>

//           {/* Right side with video player */}
//           <div className="w-full md:w-3/5">
//             <div className="relative">
//               <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-3xl blur-3xl -z-10" />
//               <div className="rounded-xl overflow-hidden shadow-lg mt-6">
//                 <AnimatePresence mode="wait">
//                   <motion.div
//                     key={activeFeature}
//                     initial={{ opacity: 0, x: 20 }}
//                     animate={{ opacity: 1, x: 0 }}
//                     exit={{ opacity: 0, x: -20 }}
//                     transition={{ duration: 0.3, ease: 'easeInOut' }}
//                     className="aspect-video w-full">
//                     {/* Use actual VideoPlayer if we have a video, otherwise use placeholder */}
//                     {currentFeature.videoSrc !== 'no_video' ? ( // In a real app, check if video exists
//                       <VideoPlayer videoSrc={currentFeature.videoSrc} />
//                     ) : (
//                       <VideoPlaceholder title={currentFeature.name} icon={currentFeature.icon} />
//                     )}
//                   </motion.div>
//                 </AnimatePresence>
//               </div>

//               {/* Feature description */}
//               {/* <motion.div
//                 key={`desc-${activeFeature}`}
//                 initial={{ opacity: 0, y: 10 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ delay: 0.2, duration: 0.3 }}
//                 className={`mt-6 p-6 rounded-xl ${
//                   darkMode ? "bg-neutral-800" : "bg-white shadow-md"
//                 }`}
//               >
//                 <h3
//                   className={`text-xl font-semibold mb-3 flex items-center gap-2 ${
//                     darkMode ? "text-white" : "text-neutral-800"
//                   }`}
//                 >
//                   <span>{currentFeature.icon}</span>
//                   <span>{currentFeature.name}</span>
//                 </h3>
//                 <p
//                   className={`${
//                     darkMode ? "text-neutral-300" : "text-neutral-600"
//                   }`}
//                 >
//                   {currentFeature.description}
//                 </p>
//                 <div className="mt-4 flex gap-4">
//                   <button className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
//                     Try This Feature
//                   </button>
//                   <button
//                     className={`px-4 py-2 rounded-lg font-medium ${
//                       darkMode
//                         ? "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
//                         : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
//                     } transition-colors`}
//                   >
//                     Learn More
//                   </button>
//                 </div>
//               </motion.div> */}
//             </div>
//           </div>
//         </div>
//         <motion.button
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           whileHover={{ scale: 1.05 }}
//           whileTap={{ scale: 0.95 }}
//           transition={{ delay: 1, duration: 0.5 }}
//           onClick={onNext}
//           className="px-6 py-2 mx-4 my-8 border-neutral-600 bg-gray-100 rounded-lg text-neutral-900 text-sm hover:shadow-[4px_4px_0px_0px_rgba(107,114,128,1)] transition duration-200 font-medium shadow-lg shadow-neutral-500/20">
//           Skip
//         </motion.button>
//       </div>
//     </div>
//   );
// }

// // Feature button component
// const FeatureButton = ({
//   feature,
//   active,
//   onClick,
// }: {
//   feature: FeatureData;
//   active: boolean;
//   onClick: () => void;
// }) => {
//   return (
//     <motion.button
//       onClick={onClick}
//       className={`w-full px-6 py-4 text-left rounded-xl transition-all duration-200 ${
//         active
//           ? 'bg-neutral-800 text-indigo-400 border border-indigo-500/30'
//           : 'text-neutral-300 hover:bg-neutral-800/50'
//       }`}
//       whileHover={{
//         x: active ? 0 : 4,
//       }}
//       whileTap={{ scale: 0.98 }}>
//       <div className="flex items-center gap-3">
//         <span className={`${active ? 'text-indigo-500' : 'text-neutral-400'}`}>{feature.icon}</span>
//         <span className="text-lg font-medium">{feature.name}</span>
//       </div>
//       <AnimatePresence mode="wait">
//         {active && (
//           <motion.p
//             initial={{ opacity: 0, height: 0 }}
//             animate={{ opacity: 1, height: 'auto' }}
//             exit={{ opacity: 0, height: 0 }}
//             className="mt-2 text-sm pl-8 text-neutral-400">
//             {feature.description}
//           </motion.p>
//         )}
//       </AnimatePresence>
//     </motion.button>
//   );
// };
