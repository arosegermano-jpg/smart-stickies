import "./App.css";

import {
  House,
  CalendarDays,
  Bell,
  GraduationCap,
  BriefcaseBusiness,
  ShoppingCart,
  Folder,
  Plus,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  BookOpen,
  Laptop,
  Dumbbell,
  Car,
  Plane,
  Utensils,
  DollarSign,
  Gift,
  Heart,
  Music,
  Camera,
  PawPrint,
  Settings2,
  Pencil,
  Trash2,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";

/* ========================================
   TYPES
   ======================================== */

type Task = {
  id: number;
  title: string;
  description?: string;
  dueDate: string;
  section: string;
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
};

type SectionIcon =
  | "graduation"
  | "work"
  | "grocery"
  | "folder"
  | "book"
  | "laptop"
  | "fitness"
  | "home"
  | "car"
  | "travel"
  | "food"
  | "money"
  | "gift"
  | "heart"
  | "music"
  | "camera"
  | "pet"
  | "calendar";

type Section = {
  name: string;
  icon: SectionIcon;
};

type View =
  | "all"
  | "today"
  | "notifications";

type SortMode =
  | "due"
  | "alphabetical"
  | "created";

type SectionEditorMode =
  | "add"
  | "edit"
  | null;

type NotificationSectionMode =
  | "all"
  | "selected";

type NotificationSettings = {
  enabled: boolean;
  reminderDays: number[];
  sectionMode: NotificationSectionMode;
  selectedSections: string[];
  notificationTime: string;
  overdueReminders: boolean;
};

/* ========================================
   ICONS
   ======================================== */

const sectionIconMap: Record<
  SectionIcon,
  LucideIcon
> = {
  graduation: GraduationCap,
  work: BriefcaseBusiness,
  grocery: ShoppingCart,
  folder: Folder,
  book: BookOpen,
  laptop: Laptop,
  fitness: Dumbbell,
  home: House,
  car: Car,
  travel: Plane,
  food: Utensils,
  money: DollarSign,
  gift: Gift,
  heart: Heart,
  music: Music,
  camera: Camera,
  pet: PawPrint,
  calendar: CalendarDays,
};

const sectionIconOptions =
  Object.keys(
    sectionIconMap
  ) as SectionIcon[];

/* ========================================
   DATE HELPERS
   ======================================== */

const getTodayString = () => {
  const today =
    new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      today.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const addDays = (
  amount: number
) => {
  const date =
    new Date();

  date.setDate(
    date.getDate() + amount
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDueDate = (
  dueDate: string
) => {
  if (!dueDate) {
    return "No due date";
  }

  const today =
    getTodayString();

  if (
    dueDate === today
  ) {
    return "Today";
  }

  if (
    dueDate === addDays(1)
  ) {
    return "Tomorrow";
  }

  const date =
    new Date(
      `${dueDate}T12:00:00`
    );

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    }
  );
};

const isTaskOverdue = (
  task: Task
) => {
  if (
    !task.dueDate ||
    task.completed
  ) {
    return false;
  }

  return (
    task.dueDate <
    getTodayString()
  );
};

const formatCompletedTime = (
  timestamp: number
) => {
  return new Date(
    timestamp
  ).toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
};

const wasCompletedToday = (
  task: Task
) => {
  if (!task.completedAt) {
    return false;
  }

  const completedDate =
    new Date(
      task.completedAt
    );

  const today =
    new Date();

  return (
    completedDate.getFullYear() ===
      today.getFullYear() &&
    completedDate.getMonth() ===
      today.getMonth() &&
    completedDate.getDate() ===
      today.getDate()
  );
};

const getSectionId = (
  sectionName: string
) => {
  return sectionName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
};

const calendarDayDifference = (
  dueDate: string,
  currentDate: string
) => {
  const [
    dueYear,
    dueMonth,
    dueDay,
  ] =
    dueDate
      .split("-")
      .map(Number);

  const [
    currentYear,
    currentMonth,
    currentDay,
  ] =
    currentDate
      .split("-")
      .map(Number);

  const dueUtc =
    Date.UTC(
      dueYear,
      dueMonth - 1,
      dueDay
    );

  const currentUtc =
    Date.UTC(
      currentYear,
      currentMonth - 1,
      currentDay
    );

  return Math.round(
    (
      dueUtc -
      currentUtc
    ) /
      86400000
  );
};

const getReminderDescription = (
  daysUntilDue: number
) => {
  if (
    daysUntilDue === 0
  ) {
    return "due today";
  }

  if (
    daysUntilDue === 1
  ) {
    return "due tomorrow";
  }

  if (
    daysUntilDue > 1
  ) {
    return `due in ${daysUntilDue} days`;
  }

  if (
    daysUntilDue === -1
  ) {
    return "1 day overdue";
  }

  return `${Math.abs(
    daysUntilDue
  )} days overdue`;
};

/* ========================================
   STARTING DATA
   ======================================== */
const initialTasks: Task[] = [
  {
    id: 1,
    title: "Welcome to SmartStickies 👋",
    description:
      "SmartStickies is a simple agenda for organizing tasks by section and due date. Add your own task with + New Task, and choose when you want reminders under Notifications.",
    dueDate: "",
    section: "Welcome",
    completed: false,
    completedAt: null,
    createdAt: 1,
  },
];

const initialSections: Section[] = [
  {
    name: "Welcome",
    icon: "folder",
  },
];
/* ========================================
   NOTIFICATION DEFAULTS
   ======================================== */

const defaultNotificationSettings: NotificationSettings =
  {
    enabled:
      true,

    reminderDays:
      [0, 1],

    sectionMode:
      "all",

    selectedSections:
      [],

    notificationTime:
      "09:00",

    overdueReminders:
      true,
  };

const presetReminderDays =
  [0, 1, 3, 7];

const notificationPresets = [
  {
    days: 0,
    title:
      "Day task is due",
    description:
      "Get a reminder on the due date.",
  },

  {
    days: 1,
    title:
      "1 day before",
    description:
      "A quick heads-up the day before.",
  },

  {
    days: 3,
    title:
      "3 days before",
    description:
      "Useful for tasks that need a little planning.",
  },

  {
    days: 7,
    title:
      "1 week before",
    description:
      "Get an earlier reminder for bigger tasks.",
  },
];

/* ========================================
   STORAGE
   ======================================== */

const TASKS_STORAGE_KEY =
  "smartstickies-tasks-v3";

const SECTIONS_STORAGE_KEY =
  "smartstickies-sections-v2";

const NOTIFICATIONS_STORAGE_KEY =
  "smartstickies-notifications-v1";

const LAST_NOTIFICATION_DATE_KEY =
  "smartstickies-last-notification-date-v1";

const loadTasks =
  (): Task[] => {
    try {
      const saved =
        localStorage.getItem(
          TASKS_STORAGE_KEY
        );

      if (!saved) {
        return initialTasks;
      }

      const parsed =
        JSON.parse(saved);

      return Array.isArray(
        parsed
      )
        ? parsed
        : initialTasks;
    } catch {
      return initialTasks;
    }
  };

const isSectionIcon = (
  value: unknown
): value is SectionIcon => {
  return sectionIconOptions.includes(
    value as SectionIcon
  );
};

const loadSections =
  (): Section[] => {
    try {
      const saved =
        localStorage.getItem(
          SECTIONS_STORAGE_KEY
        );

      if (!saved) {
        return initialSections;
      }

      const parsed =
        JSON.parse(saved);

      if (
        !Array.isArray(
          parsed
        )
      ) {
        return initialSections;
      }

      const cleaned: Section[] =
        parsed
          .filter(
            (item) =>
              item &&
              typeof item.name ===
                "string"
          )
          .map(
            (item) => ({
              name:
                item.name,

              icon:
                isSectionIcon(
                  item.icon
                )
                  ? item.icon
                  : "folder",
            })
          );

      return cleaned.length
        ? cleaned
        : initialSections;
    } catch {
      return initialSections;
    }
  };

const loadNotificationSettings =
  (): NotificationSettings => {
    try {
      const saved =
        localStorage.getItem(
          NOTIFICATIONS_STORAGE_KEY
        );

      if (!saved) {
        return defaultNotificationSettings;
      }

      const parsed =
        JSON.parse(saved);

      return {
        ...defaultNotificationSettings,
        ...parsed,

        reminderDays:
          Array.isArray(
            parsed.reminderDays
          )
            ? parsed.reminderDays
            : defaultNotificationSettings.reminderDays,

        selectedSections:
          Array.isArray(
            parsed.selectedSections
          )
            ? parsed.selectedSections
            : [],
      };
    } catch {
      return defaultNotificationSettings;
    }
  };

/* ========================================
   APP
   ======================================== */

function App() {
  const [
    tasks,
    setTasks,
  ] =
    useState<Task[]>(
      loadTasks
    );

  const [
    sections,
    setSections,
  ] =
    useState<Section[]>(
      loadSections
    );

  const [
    notificationSettings,
    setNotificationSettings,
  ] =
    useState<NotificationSettings>(
      loadNotificationSettings
    );

  const [
    activeView,
    setActiveView,
  ] =
    useState<View>(
      "all"
    );

  const [
    sortMode,
    setSortMode,
  ] =
    useState<SortMode>(
      "due"
    );

  const [
    sortMenuOpen,
    setSortMenuOpen,
  ] =
    useState(false);

  const [
    newTaskOpen,
    setNewTaskOpen,
  ] =
    useState(false);

  const [
    completedOpen,
    setCompletedOpen,
  ] =
    useState(true);

  const [
    clearConfirmOpen,
    setClearConfirmOpen,
  ] =
    useState(false);

  /* ========================================
     NEW TASK
     ======================================== */

  const [
    newTaskTitle,
    setNewTaskTitle,
  ] =
    useState("");

  const [
    newTaskSection,
    setNewTaskSection,
  ] =
    useState(
      sections[0]?.name ??
        ""
    );

  const [
    newTaskDueDate,
    setNewTaskDueDate,
  ] =
    useState(
      getTodayString()
    );

  /* ========================================
     TASK EDITING
     ======================================== */

  const [
    taskMenuOpenId,
    setTaskMenuOpenId,
  ] =
    useState<
      number | null
    >(null);

  const [
    editingTaskId,
    setEditingTaskId,
  ] =
    useState<
      number | null
    >(null);

  const [
    editTaskTitle,
    setEditTaskTitle,
  ] =
    useState("");

  const [
    editTaskSection,
    setEditTaskSection,
  ] =
    useState("");

  const [
    editTaskDueDate,
    setEditTaskDueDate,
  ] =
    useState("");

  const [
    deleteTaskId,
    setDeleteTaskId,
  ] =
    useState<
      number | null
    >(null);

  /* ========================================
     SECTION MANAGEMENT
     ======================================== */

  const [
    sectionManagerOpen,
    setSectionManagerOpen,
  ] =
    useState(false);

  const [
    sectionEditorMode,
    setSectionEditorMode,
  ] =
    useState<SectionEditorMode>(
      null
    );

  const [
    sectionBeingEdited,
    setSectionBeingEdited,
  ] =
    useState<
      string | null
    >(null);

  const [
    sectionDraftName,
    setSectionDraftName,
  ] =
    useState("");

  const [
    sectionDraftIcon,
    setSectionDraftIcon,
  ] =
    useState<SectionIcon>(
      "folder"
    );

  const [
    sectionFormError,
    setSectionFormError,
  ] =
    useState("");

  const [
    deleteSectionName,
    setDeleteSectionName,
  ] =
    useState<
      string | null
    >(null);

  const [
    deleteMoveTarget,
    setDeleteMoveTarget,
  ] =
    useState("");

  /* ========================================
     NOTIFICATIONS + STARTUP
     ======================================== */

  const [
    customReminderDays,
    setCustomReminderDays,
  ] =
    useState("");

  const [
    launchAtLogin,
    setLaunchAtLogin,
  ] =
    useState(false);

  const [
    autostartBusy,
    setAutostartBusy,
  ] =
    useState(true);

  const today =
    getTodayString();

  /* ========================================
     AUTO SAVE
     ======================================== */

  useEffect(() => {
    localStorage.setItem(
      TASKS_STORAGE_KEY,
      JSON.stringify(
        tasks
      )
    );
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(
      SECTIONS_STORAGE_KEY,
      JSON.stringify(
        sections
      )
    );
  }, [sections]);

  useEffect(() => {
    localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(
        notificationSettings
      )
    );
  }, [
    notificationSettings,
  ]);

  /* ========================================
     LOAD REAL MAC AUTOSTART STATE
     ======================================== */

  useEffect(() => {
    let cancelled =
      false;

    const loadAutostartStatus =
      async () => {
        try {
          const enabled =
            await isAutostartEnabled();

          if (!cancelled) {
            setLaunchAtLogin(
              enabled
            );
          }
        } catch (error) {
          console.error(
            "Could not check SmartStickies autostart:",
            error
          );
        } finally {
          if (!cancelled) {
            setAutostartBusy(
              false
            );
          }
        }
      };

    loadAutostartStatus();

    return () => {
      cancelled =
        true;
    };
  }, []);

  /* ========================================
     AUTOMATIC NOTIFICATION ENGINE
     ======================================== */

  useEffect(() => {
    const checkForNotifications =
      async () => {
        if (
          !notificationSettings.enabled
        ) {
          return;
        }

        const now =
          new Date();

        const todayString =
          getTodayString();

        const [
          selectedHour,
          selectedMinute,
        ] =
          notificationSettings
            .notificationTime
            .split(":")
            .map(Number);

        if (
          Number.isNaN(
            selectedHour
          ) ||
          Number.isNaN(
            selectedMinute
          )
        ) {
          return;
        }

        const currentMinutes =
          now.getHours() *
            60 +
          now.getMinutes();

        const reminderMinutes =
          selectedHour *
            60 +
          selectedMinute;

        if (
          currentMinutes <
          reminderMinutes
        ) {
          return;
        }

        if (
          localStorage.getItem(
            LAST_NOTIFICATION_DATE_KEY
          ) === todayString
        ) {
          return;
        }

        const matchingTasks =
          tasks
            .filter(
              (task) => {
                if (
                  task.completed ||
                  !task.dueDate
                ) {
                  return false;
                }

                if (
                  notificationSettings.sectionMode ===
                    "selected" &&
                  !notificationSettings.selectedSections.includes(
                    task.section
                  )
                ) {
                  return false;
                }

                const daysUntilDue =
                  calendarDayDifference(
                    task.dueDate,
                    todayString
                  );

                if (
                  daysUntilDue <
                  0
                ) {
                  return (
                    notificationSettings
                      .overdueReminders
                  );
                }

                return notificationSettings
                  .reminderDays
                  .includes(
                    daysUntilDue
                  );
              }
            )
            .sort(
              (a, b) =>
                a.dueDate.localeCompare(
                  b.dueDate
                )
            );

        if (
          matchingTasks.length ===
          0
        ) {
          return;
        }

        try {
          const permissionGranted =
            await isPermissionGranted();

          if (
            !permissionGranted
          ) {
            return;
          }

          if (
            localStorage.getItem(
              LAST_NOTIFICATION_DATE_KEY
            ) === todayString
          ) {
            return;
          }

          const previewTasks =
            matchingTasks.slice(
              0,
              4
            );

          const lines =
            previewTasks.map(
              (task) => {
                const daysUntilDue =
                  calendarDayDifference(
                    task.dueDate,
                    todayString
                  );

                return `• ${
                  task.title
                } — ${getReminderDescription(
                  daysUntilDue
                )}`;
              }
            );

          if (
            matchingTasks.length >
            4
          ) {
            lines.push(
              `+${
                matchingTasks.length -
                4
              } more task${
                matchingTasks.length -
                  4 ===
                1
                  ? ""
                  : "s"
              }`
            );
          }

          const notificationTitle =
            matchingTasks.length ===
            1
              ? "SmartStickies Reminder"
              : `${matchingTasks.length} tasks need your attention`;

          localStorage.setItem(
            LAST_NOTIFICATION_DATE_KEY,
            todayString
          );

          try {
            sendNotification({
              title:
                notificationTitle,

              body:
                lines.join(
                  "\n"
                ),
            });
          } catch (error) {
            localStorage.removeItem(
              LAST_NOTIFICATION_DATE_KEY
            );

            throw error;
          }
        } catch (error) {
          console.error(
            "SmartStickies notification error:",
            error
          );
        }
      };

    checkForNotifications();

    const interval =
      window.setInterval(
        checkForNotifications,
        60 * 1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    tasks,
    notificationSettings,
  ]);

  /* ========================================
     COUNTS
     ======================================== */

  const activeTasks =
    tasks.filter(
      (task) =>
        !task.completed
    );

  const completedTasks =
    tasks.filter(
      (task) =>
        task.completed
    );

  const completedTodayTasks =
    completedTasks
      .filter(
        wasCompletedToday
      )
      .sort(
        (a, b) =>
          (b.completedAt ??
            0) -
          (a.completedAt ??
            0)
      );

  const remainingCount =
    activeTasks.length;

  const completedCount =
    completedTasks.length;

  const totalTaskCount =
    tasks.length;

  const dueTodayCount =
    activeTasks.filter(
      (task) =>
        task.dueDate ===
        today
    ).length;

  const overallProgress =
    totalTaskCount === 0
      ? 0
      : Math.round(
          (
            completedCount /
            totalTaskCount
          ) *
            100
        );

  /* ========================================
     SORTING
     ======================================== */

  const sortedTasks =
    useMemo(() => {
      const copy =
        [...activeTasks];

      if (
        sortMode ===
        "due"
      ) {
        copy.sort(
          (a, b) => {
            if (
              !a.dueDate &&
              !b.dueDate
            ) {
              return 0;
            }

            if (!a.dueDate) {
              return 1;
            }

            if (!b.dueDate) {
              return -1;
            }

            return a.dueDate.localeCompare(
              b.dueDate
            );
          }
        );
      }

      if (
        sortMode ===
        "alphabetical"
      ) {
        copy.sort(
          (a, b) =>
            a.title.localeCompare(
              b.title
            )
        );
      }

      if (
        sortMode ===
        "created"
      ) {
        copy.sort(
          (a, b) =>
            a.createdAt -
            b.createdAt
        );
      }

      return copy;
    }, [
      activeTasks,
      sortMode,
    ]);

  const visibleTasks =
    activeView ===
    "today"
      ? sortedTasks.filter(
          (task) =>
            task.dueDate ===
            today
        )
      : activeView ===
          "all"
        ? sortedTasks
        : [];

  const visibleSections =
    sections.filter(
      (section) =>
        visibleTasks.some(
          (task) =>
            task.section ===
            section.name
        )
    );

  /* ========================================
     TASK FUNCTIONS
     ======================================== */

  const toggleTask = (
    taskId: number
  ) => {
    setTasks(
      (current) =>
        current.map(
          (task) => {
            if (
              task.id !==
              taskId
            ) {
              return task;
            }

            if (
              task.completed
            ) {
              return {
                ...task,

                completed:
                  false,

                completedAt:
                  null,
              };
            }

            return {
              ...task,

              completed:
                true,

              completedAt:
                Date.now(),
            };
          }
        )
    );

    setTaskMenuOpenId(
      null
    );
  };

  const clearCompletedTasks =
    () => {
      setTasks(
        (current) =>
          current.filter(
            (task) =>
              !task.completed
          )
      );

      setClearConfirmOpen(
        false
      );
    };

  const openNewTask =
    () => {
      setEditingTaskId(
        null
      );

      setTaskMenuOpenId(
        null
      );

      setDeleteTaskId(
        null
      );

      setNewTaskTitle(
        ""
      );

      setNewTaskDueDate(
        today
      );

      if (
        !sections.some(
          (section) =>
            section.name ===
            newTaskSection
        )
      ) {
        setNewTaskSection(
          sections[0]
            ?.name ?? ""
        );
      }

      setNewTaskOpen(
        true
      );
    };

  const handleAddTask =
    () => {
      const cleaned =
        newTaskTitle.trim();

      if (
        !cleaned ||
        !newTaskSection
      ) {
        return;
      }

      const newTask: Task =
        {
          id:
            Date.now(),

          title:
            cleaned,

          dueDate:
            newTaskDueDate,

          section:
            newTaskSection,

          completed:
            false,

          completedAt:
            null,

          createdAt:
            Date.now(),
        };

      setTasks(
        (current) => [
          ...current,
          newTask,
        ]
      );

      setNewTaskTitle(
        ""
      );

      setNewTaskOpen(
        false
      );

      setActiveView(
        "all"
      );

      setTimeout(
        () => {
          document
            .getElementById(
              getSectionId(
                newTaskSection
              )
            )
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "start",
            });
        },
        50
      );
    };

  const startEditTask =
    (
      task: Task
    ) => {
      setNewTaskOpen(
        false
      );

      setDeleteTaskId(
        null
      );

      setTaskMenuOpenId(
        null
      );

      setEditingTaskId(
        task.id
      );

      setEditTaskTitle(
        task.title
      );

      setEditTaskSection(
        task.section
      );

      setEditTaskDueDate(
        task.dueDate
      );
    };

  const cancelEditTask =
    () => {
      setEditingTaskId(
        null
      );
    };

  const saveEditedTask =
    () => {
      const cleaned =
        editTaskTitle.trim();

      if (
        !cleaned ||
        editingTaskId ===
          null
      ) {
        return;
      }

      setTasks(
        (current) =>
          current.map(
            (task) =>
              task.id ===
              editingTaskId
                ? {
                    ...task,

                    title:
                      cleaned,

                    section:
                      editTaskSection,

                    dueDate:
                      editTaskDueDate,
                  }
                : task
          )
      );

      setEditingTaskId(
        null
      );
    };

  const requestDeleteTask =
    (
      taskId: number
    ) => {
      setDeleteTaskId(
        taskId
      );
    };

  const confirmDeleteTask =
    (
      taskId: number
    ) => {
      setTasks(
        (current) =>
          current.filter(
            (task) =>
              task.id !==
              taskId
          )
      );

      setDeleteTaskId(
        null
      );

      setTaskMenuOpenId(
        null
      );

      if (
        editingTaskId ===
        taskId
      ) {
        setEditingTaskId(
          null
        );
      }
    };

  /* ========================================
     SECTION CLICK
     ======================================== */

  const handleSectionClick =
    (
      sectionName: string
    ) => {
      const hasTasks =
        activeTasks.some(
          (task) =>
            task.section ===
            sectionName
        );

      if (!hasTasks) {
        return;
      }

      setActiveView(
        "all"
      );

      setTimeout(
        () => {
          document
            .getElementById(
              getSectionId(
                sectionName
              )
            )
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "start",
            });
        },
        50
      );
    };

  /* ========================================
     SECTION MANAGER
     ======================================== */

  const resetSectionEditor =
    () => {
      setSectionEditorMode(
        null
      );

      setSectionBeingEdited(
        null
      );

      setSectionDraftName(
        ""
      );

      setSectionDraftIcon(
        "folder"
      );

      setSectionFormError(
        ""
      );
    };

  const openSectionManager =
    () => {
      setSectionManagerOpen(
        true
      );

      resetSectionEditor();

      setDeleteSectionName(
        null
      );
    };

  const closeSectionManager =
    () => {
      setSectionManagerOpen(
        false
      );

      resetSectionEditor();

      setDeleteSectionName(
        null
      );

      setDeleteMoveTarget(
        ""
      );
    };

  const openAddSection =
    () => {
      setDeleteSectionName(
        null
      );

      setSectionEditorMode(
        "add"
      );

      setSectionBeingEdited(
        null
      );

      setSectionDraftName(
        ""
      );

      setSectionDraftIcon(
        "folder"
      );

      setSectionFormError(
        ""
      );
    };

  const openEditSection =
    (
      section: Section
    ) => {
      setDeleteSectionName(
        null
      );

      setSectionEditorMode(
        "edit"
      );

      setSectionBeingEdited(
        section.name
      );

      setSectionDraftName(
        section.name
      );

      setSectionDraftIcon(
        section.icon
      );

      setSectionFormError(
        ""
      );
    };

  const saveSection =
    () => {
      const cleaned =
        sectionDraftName.trim();

      if (!cleaned) {
        setSectionFormError(
          "Enter a section name."
        );

        return;
      }

      const duplicate =
        sections.some(
          (section) =>
            section.name.toLowerCase() ===
              cleaned.toLowerCase() &&
            section.name !==
              sectionBeingEdited
        );

      if (duplicate) {
        setSectionFormError(
          "That section already exists."
        );

        return;
      }

      if (
        sectionEditorMode ===
        "add"
      ) {
        setSections(
          (current) => [
            ...current,

            {
              name:
                cleaned,

              icon:
                sectionDraftIcon,
            },
          ]
        );

        setNewTaskSection(
          cleaned
        );

        resetSectionEditor();

        return;
      }

      if (
        sectionEditorMode ===
          "edit" &&
        sectionBeingEdited
      ) {
        const oldName =
          sectionBeingEdited;

        setSections(
          (current) =>
            current.map(
              (section) =>
                section.name ===
                oldName
                  ? {
                      name:
                        cleaned,

                      icon:
                        sectionDraftIcon,
                    }
                  : section
            )
        );

        setTasks(
          (current) =>
            current.map(
              (task) =>
                task.section ===
                oldName
                  ? {
                      ...task,

                      section:
                        cleaned,
                    }
                  : task
            )
        );

        setNotificationSettings(
          (current) => ({
            ...current,

            selectedSections:
              current.selectedSections.map(
                (name) =>
                  name ===
                  oldName
                    ? cleaned
                    : name
              ),
          })
        );

        if (
          newTaskSection ===
          oldName
        ) {
          setNewTaskSection(
            cleaned
          );
        }

        if (
          editTaskSection ===
          oldName
        ) {
          setEditTaskSection(
            cleaned
          );
        }

        resetSectionEditor();
      }
    };

  const requestDeleteSection =
    (
      sectionName: string
    ) => {
      if (
        sections.length <=
        1
      ) {
        return;
      }

      resetSectionEditor();

      setDeleteSectionName(
        sectionName
      );

      const target =
        sections.find(
          (section) =>
            section.name !==
            sectionName
        );

      setDeleteMoveTarget(
        target?.name ??
          ""
      );
    };

  const confirmDeleteSection =
    () => {
      if (
        !deleteSectionName
      ) {
        return;
      }

      const deleting =
        deleteSectionName;

      const hasTasks =
        tasks.some(
          (task) =>
            task.section ===
            deleting
        );

      if (
        hasTasks &&
        !deleteMoveTarget
      ) {
        return;
      }

      if (hasTasks) {
        setTasks(
          (current) =>
            current.map(
              (task) =>
                task.section ===
                deleting
                  ? {
                      ...task,

                      section:
                        deleteMoveTarget,
                    }
                  : task
            )
        );
      }

      setSections(
        (current) =>
          current.filter(
            (section) =>
              section.name !==
              deleting
          )
      );

      setNotificationSettings(
        (current) => ({
          ...current,

          selectedSections:
            current.selectedSections.filter(
              (name) =>
                name !==
                deleting
            ),
        })
      );

      if (
        newTaskSection ===
        deleting
      ) {
        setNewTaskSection(
          deleteMoveTarget
        );
      }

      if (
        editTaskSection ===
        deleting
      ) {
        setEditTaskSection(
          deleteMoveTarget
        );
      }

      setDeleteSectionName(
        null
      );

      setDeleteMoveTarget(
        ""
      );
    };

  /* ========================================
     NOTIFICATION SETTINGS
     ======================================== */

  const handleNotificationEnabledChange =
    async (
      enabled: boolean
    ) => {
      setNotificationSettings(
        (current) => ({
          ...current,
          enabled,
        })
      );

      if (!enabled) {
        return;
      }

      try {
        let granted =
          await isPermissionGranted();

        if (!granted) {
          const permission =
            await requestPermission();

          granted =
            permission ===
            "granted";
        }
      } catch (error) {
        console.error(
          "Could not request notification permission:",
          error
        );
      }
    };

  const toggleReminderDay =
    (
      days: number
    ) => {
      setNotificationSettings(
        (current) => {
          const exists =
            current.reminderDays.includes(
              days
            );

          return {
            ...current,

            reminderDays:
              exists
                ? current.reminderDays.filter(
                    (item) =>
                      item !==
                      days
                  )
                : [
                    ...current.reminderDays,
                    days,
                  ].sort(
                    (a, b) =>
                      a - b
                  ),
          };
        }
      );
    };

  const changeSectionMode =
    (
      mode: NotificationSectionMode
    ) => {
      setNotificationSettings(
        (current) => ({
          ...current,

          sectionMode:
            mode,

          selectedSections:
            mode ===
              "selected" &&
            current.selectedSections
              .length === 0
              ? sections.map(
                  (section) =>
                    section.name
                )
              : current.selectedSections,
        })
      );
    };

  const toggleNotificationSection =
    (
      sectionName: string
    ) => {
      setNotificationSettings(
        (current) => {
          const selected =
            current.selectedSections.includes(
              sectionName
            );

          return {
            ...current,

            selectedSections:
              selected
                ? current.selectedSections.filter(
                    (name) =>
                      name !==
                      sectionName
                  )
                : [
                    ...current.selectedSections,
                    sectionName,
                  ],
          };
        }
      );
    };

  const addCustomReminder =
    () => {
      const days =
        Number(
          customReminderDays
        );

      if (
        !Number.isInteger(
          days
        ) ||
        days < 0 ||
        days > 365
      ) {
        return;
      }

      setNotificationSettings(
        (current) => ({
          ...current,

          reminderDays:
            Array.from(
              new Set([
                ...current.reminderDays,
                days,
              ])
            ).sort(
              (a, b) =>
                a - b
            ),
        })
      );

      setCustomReminderDays(
        ""
      );
    };

  const removeCustomReminder =
    (
      days: number
    ) => {
      setNotificationSettings(
        (current) => ({
          ...current,

          reminderDays:
            current.reminderDays.filter(
              (item) =>
                item !==
                days
            ),
        })
      );
    };

  const customSavedReminderDays =
    notificationSettings.reminderDays.filter(
      (days) =>
        !presetReminderDays.includes(
          days
        )
    );

  /* ========================================
     AUTOSTART
     ======================================== */

  const handleLaunchAtLoginChange =
    async (
      enabled: boolean
    ) => {
      setAutostartBusy(
        true
      );

      try {
        if (enabled) {
          await enableAutostart();
        } else {
          await disableAutostart();
        }

        const actualStatus =
          await isAutostartEnabled();

        setLaunchAtLogin(
          actualStatus
        );
      } catch (error) {
        console.error(
          "Could not change SmartStickies autostart:",
          error
        );

        try {
          const actualStatus =
            await isAutostartEnabled();

          setLaunchAtLogin(
            actualStatus
          );
        } catch {
          // Leave the current UI state alone
          // if even the status check fails.
        }
      } finally {
        setAutostartBusy(
          false
        );
      }
    };

  /* ========================================
     SORT LABEL
     ======================================== */

  const getSortLabel =
    () => {
      if (
        sortMode ===
        "due"
      ) {
        return "Sort by Due Date";
      }

      if (
        sortMode ===
        "alphabetical"
      ) {
        return "Sort Alphabetically";
      }

      return "Sort by Date Added";
    };

  /* ========================================
     SECTION EDITOR UI
     ======================================== */

  const renderSectionEditor =
    () => (
      <div className="section-editor">

        <div className="section-editor-label">
          {sectionEditorMode ===
          "add"
            ? "NEW SECTION"
            : "EDIT SECTION"}
        </div>

        <input
          className="section-name-input"
          type="text"
          value={
            sectionDraftName
          }
          placeholder="Section name"
          autoFocus
          onChange={(event) => {
            setSectionDraftName(
              event.target.value
            );

            setSectionFormError(
              ""
            );
          }}
          onKeyDown={(event) => {
            if (
              event.key ===
              "Enter"
            ) {
              saveSection();
            }

            if (
              event.key ===
              "Escape"
            ) {
              resetSectionEditor();
            }
          }}
        />

        <div className="icon-picker-label">
          Choose icon
        </div>

        <div className="icon-picker">

          {sectionIconOptions.map(
            (iconName) => {
              const Icon =
                sectionIconMap[
                  iconName
                ];

              return (
                <button
                  key={
                    iconName
                  }
                  type="button"
                  className={`icon-choice ${
                    sectionDraftIcon ===
                    iconName
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setSectionDraftIcon(
                      iconName
                    )
                  }
                >
                  <Icon
                    size={16}
                    strokeWidth={
                      1.8
                    }
                  />
                </button>
              );
            }
          )}

        </div>

        {sectionFormError && (

          <div className="section-form-error">
            {
              sectionFormError
            }
          </div>

        )}

        <div className="section-editor-actions">

          <button
            className="section-cancel"
            onClick={
              resetSectionEditor
            }
          >
            Cancel
          </button>

          <button
            className="section-save"
            onClick={
              saveSection
            }
          >
            {sectionEditorMode ===
            "add"
              ? "Add"
              : "Save"}
          </button>

        </div>

      </div>
    );

  /* ========================================
     RETURN
     ======================================== */

  return (
    <div className="app">

      {/* =====================================
          SIDEBAR
          ===================================== */}

      <aside className="sidebar">

        <div className="sidebar-top">

          <button
            className={`nav-item ${
              activeView ===
              "all"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveView(
                "all"
              )
            }
          >

            <span className="nav-icon">
              <House
                size={17}
                strokeWidth={1.8}
              />
            </span>

            <span className="nav-text">
              All Tasks
            </span>

            <span className="nav-count">
              {remainingCount}
            </span>

          </button>

          <button
            className={`nav-item ${
              activeView ===
              "today"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveView(
                "today"
              )
            }
          >

            <span className="nav-icon">
              <CalendarDays
                size={17}
                strokeWidth={1.8}
              />
            </span>

            <span className="nav-text">
              Today
            </span>

            <span className="nav-count">
              {dueTodayCount}
            </span>

          </button>

          <button
            className={`nav-item ${
              activeView ===
              "notifications"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActiveView(
                "notifications"
              );

              setNewTaskOpen(
                false
              );

              setEditingTaskId(
                null
              );
            }}
          >

            <span className="nav-icon">
              <Bell
                size={17}
                strokeWidth={1.8}
              />
            </span>

            <span className="nav-text">
              Notifications
            </span>

            <span className="nav-count" />

          </button>

          <div className="divider" />

          <div className="section-label">
            SECTIONS
          </div>

          <div className="section-scroll">

            {!sectionManagerOpen ? (

              <div className="section-menu">

                {sections.map(
                  (section) => {
                    const Icon =
                      sectionIconMap[
                        section.icon
                      ];

                    const count =
                      activeTasks.filter(
                        (task) =>
                          task.section ===
                          section.name
                      ).length;

                    return (
                      <button
                        key={
                          section.name
                        }
                        className="section-item"
                        onClick={() =>
                          handleSectionClick(
                            section.name
                          )
                        }
                      >

                        <span className="section-icon">
                          <Icon
                            size={17}
                            strokeWidth={
                              1.8
                            }
                          />
                        </span>

                        <span className="section-name">
                          {
                            section.name
                          }
                        </span>

                        <span className="section-count">
                          {count}
                        </span>

                      </button>
                    );
                  }
                )}

              </div>

            ) : (

              <div className="section-manager-list">

                {sections.map(
                  (section) => {
                    const Icon =
                      sectionIconMap[
                        section.icon
                      ];

                    const count =
                      tasks.filter(
                        (task) =>
                          task.section ===
                          section.name
                      ).length;

                    return (
                      <div
                        key={
                          section.name
                        }
                        className="managed-section"
                      >

                        <div className="managed-section-row">

                          <span className="managed-section-icon">
                            <Icon
                              size={16}
                              strokeWidth={
                                1.8
                              }
                            />
                          </span>

                          <span className="managed-section-name">
                            {
                              section.name
                            }
                          </span>

                          <div className="managed-section-buttons">

                            <button
                              className="section-small-button"
                              onClick={() =>
                                openEditSection(
                                  section
                                )
                              }
                              title="Edit section"
                            >
                              <Pencil
                                size={14}
                              />
                            </button>

                            <button
                              className="section-small-button"
                              onClick={() =>
                                requestDeleteSection(
                                  section.name
                                )
                              }
                              disabled={
                                sections.length <=
                                1
                              }
                              title="Delete section"
                            >
                              <Trash2
                                size={14}
                              />
                            </button>

                          </div>

                        </div>

                        <div className="managed-section-subtext">
                          {count}{" "}
                          {count === 1
                            ? "task"
                            : "tasks"}
                        </div>

                        {sectionEditorMode ===
                          "edit" &&
                          sectionBeingEdited ===
                            section.name &&
                          renderSectionEditor()}

                        {deleteSectionName ===
                          section.name && (

                          <div className="section-delete-panel">

                            <strong>
                              Delete “
                              {
                                section.name
                              }
                              ”?
                            </strong>

                            {count > 0 ? (

                              <>
                                <p>
                                  This section contains{" "}
                                  {count}{" "}
                                  {count === 1
                                    ? "task"
                                    : "tasks"}
                                  . Move them before deleting.
                                </p>

                                <label>
                                  Move tasks to
                                </label>

                                <select
                                  value={
                                    deleteMoveTarget
                                  }
                                  onChange={(event) =>
                                    setDeleteMoveTarget(
                                      event.target
                                        .value
                                    )
                                  }
                                >

                                  {sections
                                    .filter(
                                      (item) =>
                                        item.name !==
                                        section.name
                                    )
                                    .map(
                                      (item) => (

                                        <option
                                          key={
                                            item.name
                                          }
                                          value={
                                            item.name
                                          }
                                        >
                                          {
                                            item.name
                                          }
                                        </option>

                                      )
                                    )}

                                </select>
                              </>

                            ) : (

                              <p>
                                This section has no tasks.
                              </p>

                            )}

                            <div className="section-delete-actions">

                              <button
                                className="section-cancel"
                                onClick={() =>
                                  setDeleteSectionName(
                                    null
                                  )
                                }
                              >
                                Cancel
                              </button>

                              <button
                                className="section-delete-confirm"
                                onClick={
                                  confirmDeleteSection
                                }
                              >
                                Delete
                              </button>

                            </div>

                          </div>

                        )}

                      </div>
                    );
                  }
                )}

                {sectionEditorMode ===
                  "add" &&
                  renderSectionEditor()}

              </div>

            )}

          </div>

          {!sectionManagerOpen ? (

            <button
              className="edit-sections-button"
              onClick={
                openSectionManager
              }
            >

              <Settings2
                size={17}
                strokeWidth={1.8}
              />

              Edit Sections

            </button>

          ) : (

            <div className="section-manager-footer">

              <button
                className="manager-add-button"
                onClick={
                  openAddSection
                }
              >
                <Plus
                  size={15}
                />

                Add Section
              </button>

              <button
                className="manager-done-button"
                onClick={
                  closeSectionManager
                }
              >
                Done
              </button>

            </div>

          )}

        </div>

        <div className="sidebar-footer">

          <div className="footer-divider" />

          <div className="progress-area">

            <div
              className="progress-ring"
              style={{
                background: `
                  radial-gradient(
                    circle at center,
                    #fafafa 58%,
                    transparent 59%
                  ),
                  conic-gradient(
                    #343940
                    0deg
                    ${
                      overallProgress *
                      3.6
                    }deg,
                    #d9dcdf
                    ${
                      overallProgress *
                      3.6
                    }deg
                    360deg
                  )
                `,
              }}
            />

            <div className="progress-text">

              <strong>
                {remainingCount}{" "}
                remaining
              </strong>

              <span>
                {completedCount}{" "}
                completed
              </span>

            </div>

          </div>

        </div>

      </aside>

      {/* =====================================
          MAIN
          ===================================== */}

      <main className="main-content">

        {activeView ===
        "notifications" ? (

          <>
            <header className="page-header notification-page-header">

              <div>

                <h1>
                  Notifications
                </h1>

                <p className="page-subtitle">
                  Choose when SmartStickies should remind you about upcoming tasks.
                </p>

              </div>

            </header>

            <div className="notification-settings-scroll">

              <div className="notification-settings">

                <div className="notification-master-row">

                  <div className="notification-setting-copy">

                    <strong>
                      Enable notifications
                    </strong>

                    <span>
                      Receive reminders for upcoming and overdue tasks.
                    </span>

                  </div>

                  <label className="notification-switch">

                    <input
                      type="checkbox"
                      checked={
                        notificationSettings.enabled
                      }
                      onChange={(event) =>
                        handleNotificationEnabledChange(
                          event.target.checked
                        )
                      }
                    />

                    <span className="notification-slider" />

                  </label>

                </div>

                <fieldset
                  className="notification-fieldset"
                  disabled={
                    !notificationSettings.enabled
                  }
                >

                  <section className="notification-setting-section">

                    <div className="notification-section-heading">

                      <h2>
                        REMIND ME
                      </h2>

                      <p>
                        Choose how far ahead you want to hear about a task.
                      </p>

                    </div>

                    <div className="notification-options">

                      {notificationPresets.map(
                        (option) => (

                          <label
                            className="notification-check-row"
                            key={
                              option.days
                            }
                          >

                            <input
                              type="checkbox"
                              checked={
                                notificationSettings.reminderDays.includes(
                                  option.days
                                )
                              }
                              onChange={() =>
                                toggleReminderDay(
                                  option.days
                                )
                              }
                            />

                            <span className="settings-checkbox" />

                            <div>

                              <strong>
                                {
                                  option.title
                                }
                              </strong>

                              <span>
                                {
                                  option.description
                                }
                              </span>

                            </div>

                          </label>

                        )
                      )}

                    </div>

                    <div className="custom-reminder-area">

                      <div className="custom-reminder-title">
                        Add custom reminder
                      </div>

                      <div className="custom-reminder-controls">

                        <input
                          type="number"
                          min="0"
                          max="365"
                          placeholder="5"
                          value={
                            customReminderDays
                          }
                          onChange={(event) =>
                            setCustomReminderDays(
                              event.target.value
                            )
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              addCustomReminder();
                            }
                          }}
                        />

                        <span>
                          days before
                        </span>

                        <button
                          type="button"
                          onClick={
                            addCustomReminder
                          }
                        >
                          Add
                        </button>

                      </div>

                      {customSavedReminderDays.length >
                        0 && (

                        <div className="custom-reminder-list">

                          {customSavedReminderDays.map(
                            (days) => (

                              <div
                                key={
                                  days
                                }
                                className="custom-reminder-chip"
                              >

                                <span>
                                  {days}{" "}
                                  {days === 1
                                    ? "day"
                                    : "days"}{" "}
                                  before
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeCustomReminder(
                                      days
                                    )
                                  }
                                >
                                  <X
                                    size={12}
                                  />
                                </button>

                              </div>

                            )
                          )}

                        </div>

                      )}

                    </div>

                  </section>

                  <section className="notification-setting-section">

                    <div className="notification-section-heading">

                      <h2>
                        NOTIFY ME ABOUT
                      </h2>

                      <p>
                        Apply reminders to every section or only the ones you choose.
                      </p>

                    </div>

                    <div className="notification-radio-options">

                      <label className="notification-radio-row">

                        <input
                          type="radio"
                          name="notification-section-mode"
                          checked={
                            notificationSettings.sectionMode ===
                            "all"
                          }
                          onChange={() =>
                            changeSectionMode(
                              "all"
                            )
                          }
                        />

                        <span className="settings-radio" />

                        <div>

                          <strong>
                            All sections
                          </strong>

                          <span>
                            Current and future sections are included automatically.
                          </span>

                        </div>

                      </label>

                      <label className="notification-radio-row">

                        <input
                          type="radio"
                          name="notification-section-mode"
                          checked={
                            notificationSettings.sectionMode ===
                            "selected"
                          }
                          onChange={() =>
                            changeSectionMode(
                              "selected"
                            )
                          }
                        />

                        <span className="settings-radio" />

                        <div>

                          <strong>
                            Selected sections
                          </strong>

                          <span>
                            Only notify you about specific sections.
                          </span>

                        </div>

                      </label>

                    </div>

                    {notificationSettings.sectionMode ===
                      "selected" && (

                      <div className="notification-section-picker">

                        {sections.map(
                          (section) => {
                            const Icon =
                              sectionIconMap[
                                section.icon
                              ];

                            return (

                              <label
                                key={
                                  section.name
                                }
                                className="notification-section-choice"
                              >

                                <input
                                  type="checkbox"
                                  checked={
                                    notificationSettings.selectedSections.includes(
                                      section.name
                                    )
                                  }
                                  onChange={() =>
                                    toggleNotificationSection(
                                      section.name
                                    )
                                  }
                                />

                                <span className="settings-checkbox" />

                                <span className="notification-section-choice-icon">
                                  <Icon
                                    size={15}
                                    strokeWidth={
                                      1.8
                                    }
                                  />
                                </span>

                                <span>
                                  {
                                    section.name
                                  }
                                </span>

                              </label>

                            );
                          }
                        )}

                      </div>

                    )}

                  </section>

                  <section className="notification-setting-section">

                    <div className="notification-section-heading">

                      <h2>
                        DAILY NOTIFICATION TIME
                      </h2>

                      <p>
                        Reminders are grouped and sent at one time each day.
                      </p>

                    </div>

                    <div className="notification-time-row">

                      <div>

                        <strong>
                          Send reminders at
                        </strong>

                        <span>
                          Tasks still use dates only — this is just when SmartStickies checks in.
                        </span>

                      </div>

                      <input
                        className="notification-time-input"
                        type="time"
                        value={
                          notificationSettings.notificationTime
                        }
                        onChange={(event) =>
                          setNotificationSettings(
                            (current) => ({
                              ...current,

                              notificationTime:
                                event.target.value,
                            })
                          )
                        }
                      />

                    </div>

                  </section>

                  <section className="notification-setting-section notification-overdue-section">

                    <div className="notification-section-heading">

                      <h2>
                        OVERDUE TASKS
                      </h2>

                    </div>

                    <label className="notification-check-row">

                      <input
                        type="checkbox"
                        checked={
                          notificationSettings.overdueReminders
                        }
                        onChange={(event) =>
                          setNotificationSettings(
                            (current) => ({
                              ...current,

                              overdueReminders:
                                event.target.checked,
                            })
                          )
                        }
                      />

                      <span className="settings-checkbox" />

                      <div>

                        <strong>
                          Remind me about unfinished overdue tasks
                        </strong>

                        <span>
                          Include one daily reminder if tasks are still overdue.
                        </span>

                      </div>

                    </label>

                  </section>

                </fieldset>

                {/* =====================================
                    STARTUP
                    ===================================== */}

                <section className="notification-setting-section notification-startup-section">

                  <div className="notification-section-heading">

                    <h2>
                      STARTUP
                    </h2>

                    <p>
                      Keep SmartStickies available for reminders without opening it manually.
                    </p>

                  </div>

                  <div className="notification-startup-row">

                    <div>

                      <strong>
                        Launch SmartStickies at login
                      </strong>

                      <span>
                        Start quietly in the background when you sign in to your Mac.
                      </span>

                    </div>

                    <label
                      className={`notification-switch ${
                        autostartBusy
                          ? "is-disabled"
                          : ""
                      }`}
                    >

                      <input
                        type="checkbox"
                        checked={
                          launchAtLogin
                        }
                        disabled={
                          autostartBusy
                        }
                        onChange={(event) =>
                          handleLaunchAtLoginChange(
                            event.target.checked
                          )
                        }
                      />

                      <span className="notification-slider" />

                    </label>

                  </div>

                </section>

              </div>

            </div>

          </>

        ) : (

          <>
            <header className="page-header">

              <h1>
                {activeView ===
                "today"
                  ? "Today"
                  : "All Tasks"}
              </h1>

              <div className="header-actions">

                <div className="sort-wrapper">

                  <button
                    className="sort-button"
                    onClick={() =>
                      setSortMenuOpen(
                        !sortMenuOpen
                      )
                    }
                  >

                    {getSortLabel()}

                    <ChevronDown
                      size={13}
                      strokeWidth={1.8}
                    />

                  </button>

                  {sortMenuOpen && (

                    <div className="sort-menu">

                      <button
                        onClick={() => {
                          setSortMode(
                            "due"
                          );

                          setSortMenuOpen(
                            false
                          );
                        }}
                      >
                        Due Date
                      </button>

                      <button
                        onClick={() => {
                          setSortMode(
                            "alphabetical"
                          );

                          setSortMenuOpen(
                            false
                          );
                        }}
                      >
                        Alphabetical
                      </button>

                      <button
                        onClick={() => {
                          setSortMode(
                            "created"
                          );

                          setSortMenuOpen(
                            false
                          );
                        }}
                      >
                        Date Added
                      </button>

                    </div>

                  )}

                </div>

                <button
                  className="new-task-button"
                  onClick={
                    openNewTask
                  }
                >

                  <Plus
                    size={14}
                    strokeWidth={2}
                  />

                  New Task

                </button>

              </div>

            </header>

            {newTaskOpen && (

              <div className="new-task-panel">

                <div className="new-task-panel-header">

                  <strong>
                    New Task
                  </strong>

                  <button
                    className="close-task-form"
                    onClick={() =>
                      setNewTaskOpen(
                        false
                      )
                    }
                  >
                    <X size={16} />
                  </button>

                </div>

                <input
                  className="task-name-input"
                  type="text"
                  placeholder="What do you need to do?"
                  value={
                    newTaskTitle
                  }
                  autoFocus
                  onChange={(event) =>
                    setNewTaskTitle(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleAddTask();
                    }
                  }}
                />

                <div className="new-task-fields">

                  <label>

                    <span>
                      Section
                    </span>

                    <select
                      value={
                        newTaskSection
                      }
                      onChange={(event) =>
                        setNewTaskSection(
                          event.target.value
                        )
                      }
                    >

                      {sections.map(
                        (section) => (

                          <option
                            key={
                              section.name
                            }
                            value={
                              section.name
                            }
                          >
                            {
                              section.name
                            }
                          </option>

                        )
                      )}

                    </select>

                  </label>

                  <label>

                    <span>
                      Due Date
                    </span>

                    <input
                      type="date"
                      value={
                        newTaskDueDate
                      }
                      onChange={(event) =>
                        setNewTaskDueDate(
                          event.target.value
                        )
                      }
                    />

                  </label>

                </div>

                <div className="new-task-actions">

                  <button
                    className="cancel-task-button"
                    onClick={() =>
                      setNewTaskOpen(
                        false
                      )
                    }
                  >
                    Cancel
                  </button>

                  <button
                    className="add-task-button"
                    onClick={
                      handleAddTask
                    }
                  >
                    Add Task
                  </button>

                </div>

              </div>

            )}

            {editingTaskId !==
              null && (

              <div className="new-task-panel edit-task-panel">

                <div className="new-task-panel-header">

                  <strong>
                    Edit Task
                  </strong>

                  <button
                    className="close-task-form"
                    onClick={
                      cancelEditTask
                    }
                  >
                    <X size={16} />
                  </button>

                </div>

                <input
                  className="task-name-input"
                  type="text"
                  value={
                    editTaskTitle
                  }
                  autoFocus
                  onChange={(event) =>
                    setEditTaskTitle(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      saveEditedTask();
                    }
                  }}
                />

                <div className="new-task-fields">

                  <label>

                    <span>
                      Section
                    </span>

                    <select
                      value={
                        editTaskSection
                      }
                      onChange={(event) =>
                        setEditTaskSection(
                          event.target.value
                        )
                      }
                    >

                      {sections.map(
                        (section) => (

                          <option
                            key={
                              section.name
                            }
                            value={
                              section.name
                            }
                          >
                            {
                              section.name
                            }
                          </option>

                        )
                      )}

                    </select>

                  </label>

                  <label>

                    <span>
                      Due Date
                    </span>

                    <input
                      type="date"
                      value={
                        editTaskDueDate
                      }
                      onChange={(event) =>
                        setEditTaskDueDate(
                          event.target.value
                        )
                      }
                    />

                  </label>

                </div>

                <div className="new-task-actions">

                  <button
                    className="cancel-task-button"
                    onClick={
                      cancelEditTask
                    }
                  >
                    Cancel
                  </button>

                  <button
                    className="add-task-button"
                    onClick={
                      saveEditedTask
                    }
                  >
                    Save Changes
                  </button>

                </div>

              </div>

            )}

            <div className="task-groups">

              {visibleSections.map(
                (section) => {

                  const sectionTasks =
                    visibleTasks.filter(
                      (task) =>
                        task.section ===
                        section.name
                    );

                  return (

                    <section
                      key={
                        section.name
                      }
                      className="task-section"
                      id={getSectionId(
                        section.name
                      )}
                    >

                      <div className="task-section-header">

                        <h2>
                          {
                            section.name
                          }
                        </h2>

                        <div className="section-line" />

                      </div>

                      <div className="task-list">

                        {sectionTasks.map(
                          (task) => {

                            const overdue =
                              isTaskOverdue(
                                task
                              );

                            return (

                              <div
                                key={
                                  task.id
                                }
                                className="task-row"
                              >

                                <input
                                  className="task-checkbox"
                                  type="checkbox"
                                  checked={
                                    false
                                  }
                                  onChange={() =>
                                    toggleTask(
                                      task.id
                                    )
                                  }
                                />

                                <div className="task-copy">
                        <span className="task-title">
                          {task.title}
                        </span>

                        {task.description && (
                          <span className="task-description">
                            {task.description}
                          </span>
                        )}
                      </div>

                                <span
                                  className={`task-date ${
                                    overdue
                                      ? "task-date-overdue"
                                      : ""
                                  }`}
                                >
                                  {task.dueDate
                                    ? formatDueDate(task.dueDate)
                                    : ""}
                                </span>

                                {overdue && (

                                  <span className="overdue-flag">
                                    OVERDUE
                                  </span>

                                )}

                                <div className="task-actions-cell">

                                  <button
                                    className="task-more-button"
                                    onClick={() => {

                                      setDeleteTaskId(
                                        null
                                      );

                                      setTaskMenuOpenId(
                                        taskMenuOpenId ===
                                          task.id
                                          ? null
                                          : task.id
                                      );

                                    }}
                                  >

                                    <MoreHorizontal
                                      size={17}
                                    />

                                  </button>

                                  {taskMenuOpenId ===
                                    task.id && (

                                    <div className="task-menu">

                                      {deleteTaskId !==
                                      task.id ? (

                                        <>

                                          <button
                                            onClick={() =>
                                              startEditTask(
                                                task
                                              )
                                            }
                                          >
                                            <Pencil
                                              size={13}
                                            />

                                            Edit
                                          </button>

                                          <button
                                            onClick={() =>
                                              requestDeleteTask(
                                                task.id
                                              )
                                            }
                                          >
                                            <Trash2
                                              size={13}
                                            />

                                            Delete
                                          </button>

                                        </>

                                      ) : (

                                        <div className="task-delete-confirm">

                                          <span>
                                            Delete task?
                                          </span>

                                          <div>

                                            <button
                                              onClick={() =>
                                                setDeleteTaskId(
                                                  null
                                                )
                                              }
                                            >
                                              Cancel
                                            </button>

                                            <button
                                              className="task-delete-final"
                                              onClick={() =>
                                                confirmDeleteTask(
                                                  task.id
                                                )
                                              }
                                            >
                                              Delete
                                            </button>

                                          </div>

                                        </div>

                                      )}

                                    </div>

                                  )}

                                </div>

                              </div>

                            );
                          }
                        )}

                      </div>

                    </section>

                  );
                }
              )}

              {completedTodayTasks.length >
                0 && (

                <section className="completed-section">

                  <div className="completed-header">

                    <button
                      className="completed-toggle"
                      onClick={() => {

                        setCompletedOpen(
                          !completedOpen
                        );

                        setClearConfirmOpen(
                          false
                        );

                      }}
                    >

                      {completedOpen ? (

                        <ChevronDown
                          size={15}
                        />

                      ) : (

                        <ChevronRight
                          size={15}
                        />

                      )}

                      <span>
                        COMPLETED TODAY
                      </span>

                      <span className="completed-count">
                        {
                          completedTodayTasks.length
                        }
                      </span>

                    </button>

                    {completedOpen && (

                      <div className="clear-area">

                        {!clearConfirmOpen ? (

                          <button
                            className="clear-completed"
                            onClick={() =>
                              setClearConfirmOpen(
                                true
                              )
                            }
                          >
                            Clear
                          </button>

                        ) : (

                          <>

                            <span className="clear-question">
                              Clear all?
                            </span>

                            <button
                              className="clear-cancel"
                              onClick={() =>
                                setClearConfirmOpen(
                                  false
                                )
                              }
                            >
                              Cancel
                            </button>

                            <button
                              className="clear-confirm"
                              onClick={
                                clearCompletedTasks
                              }
                            >
                              Clear All
                            </button>

                          </>

                        )}

                      </div>

                    )}

                  </div>

                  {completedOpen && (

                    <div className="completed-list">

                      {completedTodayTasks.map(
                        (task) => (

                          <div
                            key={
                              task.id
                            }
                            className="completed-task-row"
                          >

                            <button
                              className="completed-check"
                              onClick={() =>
                                toggleTask(
                                  task.id
                                )
                              }
                            >

                              <Check
                                size={13}
                                strokeWidth={2.4}
                              />

                            </button>

                            <div className="completed-task-info">

                              <span className="completed-task-title">
                                {
                                  task.title
                                }
                              </span>

                              <span className="completed-task-meta">

                                {
                                  task.section
                                }

                                {" · Completed "}

                                {task.completedAt
                                  ? formatCompletedTime(
                                      task.completedAt
                                    )
                                  : ""}

                              </span>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  )}

                </section>

              )}

              {visibleTasks.length ===
                0 &&
                completedTodayTasks.length ===
                  0 && (

                <div className="empty-state">

                  <h2>
                    No tasks here
                  </h2>

                  <p>
                    {activeView ===
                    "today"
                      ? "You have nothing due today."
                      : "Add a task to get started."}
                  </p>

                </div>

              )}

            </div>

          </>

        )}

      </main>

    </div>
  );
}

export default App;