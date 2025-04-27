// === 5: MAIN APPLICATION SCRIPT START ===

// === 5.1: GLOBAL VARIABLES & STATE START ===
let projectData = null; // To hold data from project_data.json
let userData = null;    // To hold data from users_roles.json
let tasks = [];         // Array of task objects, processed from projectData
let users = [];         // Array of user objects
let roles = [];         // Array of role objects
let currentUser = null; // The currently selected user object
let currentView = 'dashboard'; // The currently active view ID
let notifications = []; // Simple array to simulate notifications

// DOM Element References (cached for performance)
const userSelect = document.getElementById('userSelect');
const appContent = document.getElementById('appContent');
const navButtons = document.querySelectorAll('.nav-button');
const projectStatusEl = document.getElementById('projectStatus');
const projectEtaEl = document.getElementById('projectEta');
const progressBarEl = document.getElementById('progressBar');
const progressPercentageEl = document.getElementById('progressPercentage');
const activeTasksListEl = document.getElementById('activeTasksList');
const pendingActionsListEl = document.getElementById('pendingActionsList'); // New element for actions
const latestNotificationsListEl = document.getElementById('latestNotificationsList');
const fullTaskListContainerEl = document.getElementById('fullTaskListContainer');
const myTasksListContainerEl = document.getElementById('myTasksListContainer');
const phaseFilterEl = document.getElementById('phaseFilter');
const statusFilterEl = document.getElementById('statusFilter');
const taskDetailViewEl = document.getElementById('taskDetail');
const taskDetailContentEl = document.getElementById('taskDetailContent');
const backToListButton = document.getElementById('backToListButton');
const userListBodyEl = document.getElementById('userListBody');
const waitingForListEl = document.getElementById('waitingForList');
const waitingOnMeListEl = document.getElementById('waitingOnMeList');
const newMessageButton = document.getElementById('new-message-button');
const newMessageModal = document.getElementById('newMessageModal');
const messageRecipientEl = document.getElementById('messageRecipient');
const messageSubjectEl = document.getElementById('messageSubject');
const messageBodyEl = document.getElementById('messageBody');
const sendMessageButton = document.getElementById('sendMessageButton');
const cancelMessageButton = document.getElementById('cancelMessageButton');
const messageListContainerEl = document.getElementById('messageListContainer');
// === 5.1: GLOBAL VARIABLES & STATE END ===


// === 5.2: INITIALIZATION FUNCTIONS START ===
/**
 * Helper function to remove single-line comments (//) from a JSON string.
 * @param {string} jsonString - The raw string content from the file.
 * @returns {string} - The JSON string with comments removed.
 */
function removeJsonComments(jsonString) {
    // Split into lines, filter out comment lines, join back
    return jsonString.split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .join('\n');
}

/**
 * Fetches data from JSON files, handling potential comments.
 */
async function loadData() {
    try {
        const [projectResponse, userResponse] = await Promise.all([
            fetch('project_data.json'),
            fetch('users_roles.json')
        ]);

        if (!projectResponse.ok || !userResponse.ok) {
            // Display specific error messages if fetch failed
            let errorMsg = 'Kunne ikke laste prosjektdata. ';
            if (!projectResponse.ok) {
                 errorMsg += `Feil ved henting av project_data.json (Status: ${projectResponse.status}). `;
            }
            if (!userResponse.ok) {
                 errorMsg += `Feil ved henting av users_roles.json (Status: ${userResponse.status}).`;
            }
            throw new Error(errorMsg);
        }

        // Get text content first
        const projectText = await projectResponse.text();
        const userText = await userResponse.text();

        // Remove comments (though files should be clean now) and then parse
        projectData = JSON.parse(removeJsonComments(projectText));
        userData = JSON.parse(removeJsonComments(userText));

        console.log("Data loaded and parsed successfully:", { projectData, userData });

        // Process data after loading
        processLoadedData();

    } catch (error) {
        console.error('Error loading or parsing data:', error);
        // Display a more user-friendly error message
        let displayError = 'Kunne ikke laste prosjektdata. ';
        if (error instanceof SyntaxError) {
            displayError += 'Det er en feil i formatet til en av JSON-filene. Sjekk at alle nøkler og strenger er i doble anførselstegn og at det ikke er kommentarer. Sjekk konsollen for detaljer.';
        } else {
            displayError += ` (${error.message}). Sjekk at filene er tilgjengelige og korrekt formatert.`;
        }
         appContent.innerHTML = `<p style="color: red; padding: 20px;">${displayError}</p>`;
         // Optionally hide the loading indicator in the user select dropdown
         userSelect.innerHTML = '<option value="">Feil ved lasting</option>';
    }
}


/**
 * Processes the raw data loaded from JSON into usable arrays and objects.
 */
function processLoadedData() {
    if (!projectData || !userData) return;

    tasks = projectData.tasks.map(task => ({
        ...task,
        ForutsetningerIDs: task.Forutsetninger.map(nr => `TASK-${String(nr).padStart(3, '0')}`),
        BeregnetStartDato: task.BeregnetStartDato ? new Date(task.BeregnetStartDato) : null,
        BeregnetSluttDato: task.BeregnetSluttDato ? new Date(task.BeregnetSluttDato) : null,
        FaktiskStartDato: task.FaktiskStartDato ? new Date(task.FaktiskStartDato) : null,
        FaktiskSluttDato: task.FaktiskSluttDato ? new Date(task.FaktiskSluttDato) : null,
        EstimertVarighetDager: typeof task.EstimertVarighetDager === 'number' ? task.EstimertVarighetDager : null,
        GodkjentAvLeder: false,
        ProblemBeskrivelse: null,
        JustMadeReady: false // New flag for "blinkende lys" simulation
    }));

    roles = userData.roles;
    users = userData.users;

    const projectLeader = users.find(u => u.RolleIDs.includes('ROLLE-PL')) || users[0];
    if (projectLeader) {
        currentUser = projectLeader;
    } else if (users.length > 0) {
        currentUser = users[0];
    } else {
        console.error("Ingen brukere funnet i users_roles.json!");
    }

    populateUserSelector();
    populatePhaseFilter();
    populateMessageRecipientSelector();

    calculateInitialDates();
}

/**
 * Populates the global user selector dropdown.
 */
function populateUserSelector() {
    if (!users || users.length === 0) {
         userSelect.innerHTML = '<option value="">Ingen brukere</option>';
        return;
    }
    userSelect.innerHTML = '';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.BrukerID;
        option.textContent = `${user.Navn} (${getRolesForUser(user).map(r => r.RolleNavn).join(', ')})`;
        userSelect.appendChild(option);
    });
    if (currentUser) {
        userSelect.value = currentUser.BrukerID;
    }
}

/**
 * Populates the phase filter dropdown.
 */
function populatePhaseFilter() {
    const phases = [...new Set(tasks.map(task => task.Fase))];
    phaseFilterEl.innerHTML = '<option value="all">Alle Faser</option>';
    phases.sort();
    phases.forEach(phase => {
        const option = document.createElement('option');
        option.value = phase;
        option.textContent = phase;
        phaseFilterEl.appendChild(option);
    });
}

/**
 * Populates the recipient selector in the new message modal.
 */
 function populateMessageRecipientSelector() {
    if (!users) return;
    messageRecipientEl.innerHTML = '';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.BrukerID;
        option.textContent = user.Navn;
        messageRecipientEl.appendChild(option);
    });
}

/**
 * Performs initial calculation of all task dates.
 */
 function calculateInitialDates() {
    console.log("Calculating initial task dates...");
    tasks.forEach(task => {
        task.BeregnetStartDato = calculateEarliestStartDate(task);
    });
    tasks.forEach(task => {
        if (task.BeregnetStartDato && task.EstimertVarighetDager !== null) {
            task.BeregnetSluttDato = addWorkDays(task.BeregnetStartDato, task.EstimertVarighetDager);
        } else {
            task.BeregnetSluttDato = null;
        }
    });
    console.log("Initial dates calculated.");
}


/**
 * Main initialization function called on page load.
 */
async function init() {
    console.log("Initializing application...");
    setupEventListeners();
    // Add the new dashboard card to the HTML structure before loading data
    setupDashboardCards();
    await loadData();
    if (projectData && userData) {
        renderApp();
    } else {
         console.log("Initialization halted due to data loading failure.");
    }
}

/**
 * Dynamically adds the 'Pending Actions' card structure to the dashboard grid.
 * This ensures the element exists before rendering tries to access it.
 */
function setupDashboardCards() {
    const dashboardGrid = document.querySelector('#dashboard .dashboard-grid');
    if (!dashboardGrid) return;

    // Check if the card already exists
    if (!document.getElementById('pendingActionsCard')) {
        const pendingActionsCard = document.createElement('div');
        pendingActionsCard.classList.add('card');
        pendingActionsCard.id = 'pendingActionsCard'; // Give it an ID
        pendingActionsCard.innerHTML = `
            <h3>Handlinger Kreves <span class="action-count"></span></h3>
            <ul id="pendingActionsList">
                <li>Laster...</li>
            </ul>
        `;
         // Insert it after the 'Active Tasks' card, for example
         const activeTasksCard = document.getElementById('activeTasksCard');
         if (activeTasksCard) {
            activeTasksCard.parentNode.insertBefore(pendingActionsCard, activeTasksCard.nextSibling);
         } else {
             // Fallback: append to the grid if active tasks card not found
            dashboardGrid.appendChild(pendingActionsCard);
         }
    }

}


// === 5.2: INITIALIZATION FUNCTIONS END ===


// === 5.3: RENDERING FUNCTIONS START ===

/**
 * Main render function to update the entire UI based on current state.
 */
function renderApp() {
    if (!projectData || !userData || !currentUser) {
        console.log("Render blocked: Missing data or currentUser.");
        if (!document.querySelector('#appContent p[style*="color: red;"]')) {
             appContent.innerHTML = '<p style="color: orange; padding: 20px;">Kan ikke vise data. Prøv å laste siden på nytt.</p>';
        }
        return;
    }
    const errorMsgElement = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]');
    if (errorMsgElement) {
        errorMsgElement.remove();
    }

    console.log(`Rendering app for user: ${currentUser.Navn}, view: ${currentView}`);

    renderDashboard();
    renderFullTaskList();
    renderMyTasksList();
    renderUserList();
    renderDependenciesView();
    renderMessages();

    switchView(currentView);
    updateActiveNavButton();
}

/**
 * Renders the dashboard view.
 */
function renderDashboard() {
    if (!projectData) return;
    projectStatusEl.textContent = projectData.project.Status;
    projectEtaEl.textContent = calculateProjectEta();

    const progress = calculateProjectProgress();
    progressBarEl.style.width = `${progress}%`;
    progressPercentageEl.textContent = progress;

    // Active Tasks
    const activeTasks = tasks.filter(task => task.Status === 'Pågår');
    activeTasksListEl.innerHTML = '';
    if (activeTasks.length === 0) {
        activeTasksListEl.innerHTML = '<li>Ingen aktive oppgaver</li>';
    } else {
        activeTasks.slice(0, 5).forEach(task => {
            const li = document.createElement('li');
            const responsibleRole = getRoleById(task.AnsvarligRolleID);
            li.innerHTML = `<strong style="cursor: pointer;">${task.OppgaveNr}. ${task.OppgaveNavn}</strong> (${responsibleRole ? responsibleRole.RolleNavn : 'Ukjent'})`;
            li.querySelector('strong').onclick = () => showTaskDetail(task.OppgaveID);
            activeTasksListEl.appendChild(li);
        });
    }

    // Pending Actions for current user
    renderPendingActions(); // New function call

    // Latest Notifications
    renderNotificationsList(latestNotificationsListEl, 5);
}

/**
 * Renders the "Pending Actions" card on the dashboard.
 */
 function renderPendingActions() {
    const pendingActionsListEl = document.getElementById('pendingActionsList'); // Get the element reference here
    const actionCountSpan = document.querySelector('#pendingActionsCard .action-count'); // Get the span for count
    if (!pendingActionsListEl || !actionCountSpan) return; // Ensure elements exist

    const actions = getPendingActionsForUser(currentUser);
    pendingActionsListEl.innerHTML = ''; // Clear list

    if (actions.length === 0) {
        pendingActionsListEl.innerHTML = '<li>Ingen handlinger kreves.</li>';
        actionCountSpan.textContent = ''; // Clear count
    } else {
         actionCountSpan.textContent = `(${actions.length})`; // Show count
        actions.slice(0, 5).forEach(action => { // Show max 5 on dashboard
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.innerHTML = `<strong>${action.type}:</strong> ${action.task.OppgaveNr}. ${action.task.OppgaveNavn}`;
             // Add specific styling for ready-to-start tasks ("blink")
             if (action.type === 'Start Oppgave' && action.task.JustMadeReady) {
                 li.style.backgroundColor = 'var(--status-waiting)'; // Use yellow background
                 li.style.fontWeight = 'bold';
             }
            li.onclick = () => showTaskDetail(action.task.OppgaveID);
            pendingActionsListEl.appendChild(li);
             // Reset the 'JustMadeReady' flag after displaying it once on dashboard
             if (action.type === 'Start Oppgave' && action.task.JustMadeReady) {
                 action.task.JustMadeReady = false;
             }
        });
    }
}


/**
 * Renders the full task list based on filters.
 */
function renderFullTaskList() {
    const phaseFilter = phaseFilterEl.value;
    const statusFilter = statusFilterEl.value;

    const filteredTasks = tasks.filter(task => {
        const phaseMatch = phaseFilter === 'all' || task.Fase === phaseFilter;
        const statusMatch = statusFilter === 'all' || task.Status === statusFilter;
        return phaseMatch && statusMatch;
    });

    fullTaskListContainerEl.innerHTML = '';
    if (filteredTasks.length === 0) {
        fullTaskListContainerEl.innerHTML = '<p>Ingen oppgaver matcher filtrene.</p>';
        return;
    }

    filteredTasks.sort((a, b) => a.OppgaveNr - b.OppgaveNr);

    filteredTasks.forEach(task => {
         const isViewerProjectLeader = currentUser?.RolleIDs.includes('ROLLE-PL');
        fullTaskListContainerEl.appendChild(createTaskElement(task, true, isViewerProjectLeader));
    });
}

/**
 * Renders the "My Tasks" list for the current user.
 */
function renderMyTasksList() {
    if (!currentUser) {
         myTasksListContainerEl.innerHTML = '<p>Velg en bruker for å se deres oppgaver.</p>';
        return;
    }

    const isProjectLeader = currentUser.RolleIDs.includes('ROLLE-PL');

    const myTasks = tasks.filter(task => {
        const isResponsible = currentUser.RolleIDs.includes(task.AnsvarligRolleID);
        const isWaitingForApproval = isProjectLeader && task.Status === 'Venter på Godkjenning';
        return isResponsible || isWaitingForApproval;
    });

    myTasksListContainerEl.innerHTML = '';
    if (myTasks.length === 0) {
        myTasksListContainerEl.innerHTML = '<p>Ingen relevante oppgaver for denne brukeren/rollen akkurat nå.</p>';
        return;
    }

    myTasks.sort((a, b) => {
        const statusOrder = {
            "Problem Rapportert": 1,
            "Venter på Godkjenning": 2,
            "Pågår": 3,
            "Ikke startet": 4,
            "Venter på forutsetning": 5,
            "Utført": 6
        };
        const effectiveStatusA = (isProjectLeader && a.Status === 'Venter på Godkjenning') ? 'Venter på Godkjenning' : a.Status;
        const effectiveStatusB = (isProjectLeader && b.Status === 'Venter på Godkjenning') ? 'Venter på Godkjenning' : b.Status;
        const orderA = statusOrder[effectiveStatusA] || 99;
        const orderB = statusOrder[effectiveStatusB] || 99;
        if (orderA !== orderB) return orderA - orderB;

         const dateA = a.BeregnetStartDato || new Date('9999-12-31');
         const dateB = b.BeregnetStartDato || new Date('9999-12-31');
        const dateAIsValid = dateA instanceof Date && !isNaN(dateA);
        const dateBIsValid = dateB instanceof Date && !isNaN(dateB);
        if (dateAIsValid && dateBIsValid) {
             if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
         } else if (dateAIsValid) return -1;
           else if (dateBIsValid) return 1;

        return a.OppgaveNr - b.OppgaveNr;
    });

    myTasks.forEach(task => {
        myTasksListContainerEl.appendChild(createTaskElement(task, false, isProjectLeader));
    });
}

/**
 * Creates an HTML element representing a single task item.
 */
function createTaskElement(task, isAdminView, isViewerProjectLeader = false) {
    const taskElement = document.createElement('div');
    taskElement.classList.add('task-item');
    taskElement.dataset.taskId = task.OppgaveID;
    taskElement.dataset.status = task.Status;

    const responsibleRole = getRoleById(task.AnsvarligRolleID);
    const durationText = task.EstimertVarighetDager !== null ? `${task.EstimertVarighetDager} dager` : 'Ikke estimert';

    const approvalCue = (isViewerProjectLeader && task.Status === 'Venter på Godkjenning')
        ? `<strong style="color:var(--status-pending-approval); margin-left: 10px;">⚠️ Til Godkjenning</strong>`
        : '';
    const problemCue = (task.Status === 'Problem Rapportert')
        ? `<strong style="color:var(--status-problem)"> (${task.ProblemBeskrivelse || 'Problem rapportert'})</strong>`
        : '';
     // New: Cue for tasks ready to start
     const readyToStartCue = (task.Status === 'Ikke startet' && arePrerequisitesMet(task) && currentUser.RolleIDs.includes(task.AnsvarligRolleID))
         ? `<strong style="color: green; margin-left: 10px;">✅ Klar til start!</strong>`
         : '';


    taskElement.innerHTML = `
        <h4>${task.OppgaveNr}. ${task.OppgaveNavn} ${approvalCue} ${readyToStartCue}</h4>
        <div class="task-meta">
            Ansvarlig: ${responsibleRole ? responsibleRole.RolleNavn : 'Ukjent'} | Status: ${task.Status}
            ${problemCue}
             | Start: ${formatDate(task.BeregnetStartDato)} | Slutt: ${formatDate(task.BeregnetSluttDato)}
        </div>
        <div class="task-duration">${durationText}</div>
        <div class="task-actions">
            <button class="details-button">Detaljer</button>
            ${isAdminView && isViewerProjectLeader && task.Status !== 'Utført' ?
                '<button class="admin-complete-button" title="Admin: Hurtigfullfør (inkl. godkjenning)">⚡ Fullfør</button>'
                : ''
            }
        </div>
    `;

    taskElement.querySelector('.details-button').addEventListener('click', (e) => {
        e.stopPropagation();
        showTaskDetail(task.OppgaveID);
    });

    const adminCompleteButton = taskElement.querySelector('.admin-complete-button');
    if (adminCompleteButton) {
        adminCompleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            adminMarkTaskComplete(task.OppgaveID);
        });
    }

     // Add "blink" effect styling if JustMadeReady
     if (task.JustMadeReady && task.Status === 'Ikke startet') {
         taskElement.style.animation = 'blinkBackground 1.5s ease-in-out 2'; // Blink twice
     }


    return taskElement;
}

/**
 * Renders the task detail view.
 */
function showTaskDetail(taskId) {
    const task = findTaskById(taskId);
    if (!task) return;

    const errorMsgElement = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]');
    if (errorMsgElement) errorMsgElement.remove();

    currentView = 'taskDetail';
    taskDetailViewEl.classList.add('active-view');
    document.querySelectorAll('.view:not(#taskDetail)').forEach(v => v.classList.remove('active-view'));

    const responsibleRole = getRoleById(task.AnsvarligRolleID);
    const responsibleUsers = findUsersByRole(task.AnsvarligRolleID);

    let prerequisitesHtml = 'Ingen';
    if (task.ForutsetningerIDs && task.ForutsetningerIDs.length > 0) {
        prerequisitesHtml = '<ul>';
        task.ForutsetningerIDs.forEach(preReqId => {
            const preReqTask = findTaskById(preReqId);
            if (preReqTask) {
                const statusIcon = preReqTask.Status === 'Utført' ? '✅' : (preReqTask.Status === 'Pågår' ? '⏳' : '⚪');
                prerequisitesHtml += `<li>${statusIcon} ${preReqTask.OppgaveNr}. ${preReqTask.OppgaveNavn} (${preReqTask.Status})</li>`;
            } else {
                prerequisitesHtml += `<li>Ukjent forutsetning (ID: ${preReqId})</li>`;
            }
        });
        prerequisitesHtml += '</ul>';
    }

     let successorsHtml = 'Ingen';
     const successorTasks = tasks.filter(t => t.ForutsetningerIDs?.includes(task.OppgaveID));
     if (successorTasks.length > 0) {
         successorsHtml = '<ul>';
         successorTasks.forEach(succTask => {
             successorsHtml += `<li>${succTask.OppgaveNr}. ${succTask.OppgaveNavn} (${succTask.Status})</li>`;
         });
         successorsHtml += '</ul>';
     }

    let actionButtonsHtml = generateActionButtons(task);

    taskDetailContentEl.innerHTML = `
        <h3>Generell Informasjon</h3>
        <p><strong>Fase:</strong> ${task.Fase}</p>
        <p><strong>Beskrivelse:</strong> ${task.Beskrivelse || 'Ingen beskrivelse.'}</p>
        <p><strong>Ansvarlig Rolle:</strong> ${responsibleRole ? responsibleRole.RolleNavn : 'Ukjent'}</p>
        <p><strong>Ansvarlig(e) Bruker(e):</strong>
            ${responsibleUsers.length > 0 ? responsibleUsers.map(u => `<span class="clickable-user" data-user-id="${u.BrukerID}">${u.Navn}</span>`).join(', ') : 'Ingen brukere funnet'}
        </p>
        <h3>Status & Tidsplan</h3>
        <p><strong>Nåværende Status:</strong> ${task.Status}</p>
        ${task.Status === 'Problem Rapportert' ? `<p style="color:var(--status-problem)"><strong>Problem:</strong> ${task.ProblemBeskrivelse || 'Problem rapportert'}</p>` : ''}
        ${task.Status === 'Venter på Godkjenning' ? `<p style="color:var(--status-pending-approval)"><strong>Venter på godkjenning fra Prosjektleder.</strong></p>` : ''}
        <p><strong>Estimert Varighet:</strong>
           <input type="number" id="durationInput_${task.OppgaveID}" value="${task.EstimertVarighetDager !== null ? task.EstimertVarighetDager : ''}" min="0" step="1" ${canEditDuration(task) ? '' : 'disabled'} style="width: 60px; margin-left: 5px;"> dager
           ${canEditDuration(task) ? `<button class="save-duration-button" data-task-id="${task.OppgaveID}">Lagre</button>` : ''}
        </p>
        <p><strong>Beregnet Start:</strong> ${formatDate(task.BeregnetStartDato)}</p>
        <p><strong>Beregnet Slutt:</strong> ${formatDate(task.BeregnetSluttDato)}</p>
        <p><strong>Faktisk Start:</strong> ${formatDate(task.FaktiskStartDato)}</p>
        <p><strong>Faktisk Slutt:</strong> ${formatDate(task.FaktiskSluttDato)}</p>
        <div class="task-detail-actions">${actionButtonsHtml}</div>
        <h3>Avhengigheter</h3>
        <p><strong>Forutsetninger (Må være ferdig først):</strong></p>
        ${prerequisitesHtml}
        <p><strong>Etterfølgende Oppgaver (Venter på denne):</strong></p>
        ${successorsHtml}
        <h3>Kommunikasjon (Simulert)</h3>
        <textarea id="taskCommentInput" placeholder="Legg til notat/melding knyttet til oppgaven..."></textarea>
        <button id="addTaskCommentButton">Legg til Notat</button>
        <ul id="taskCommentsList"><li>Ingen notater ennå.</li></ul>
        <div class="user-selector task-detail-user-selector" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--gray-medium);">
            <label for="taskDetailUserSelect">Vis denne oppgaven som:</label>
            <select id="taskDetailUserSelect"></select>
        </div>
    `;

    populateTaskDetailUserSelector(taskId);
    addTaskDetailEventListeners(task);
}

/**
 * Populates the user selector within the task detail view.
 */
 function populateTaskDetailUserSelector(taskId) {
    const taskDetailSelect = document.getElementById('taskDetailUserSelect');
    if (!taskDetailSelect || !users) return;
    taskDetailSelect.innerHTML = '';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.BrukerID;
        option.textContent = `${user.Navn} (${getRolesForUser(user).map(r => r.RolleNavn).join(', ')})`;
        taskDetailSelect.appendChild(option);
    });
    if (currentUser) {
        taskDetailSelect.value = currentUser.BrukerID;
    }
    taskDetailSelect.removeEventListener('change', handleTaskDetailUserChange);
    taskDetailSelect.addEventListener('change', handleTaskDetailUserChange);
}

/**
 * Renders the user list table.
 */
function renderUserList() {
    userListBodyEl.innerHTML = '';
    if (!users || users.length === 0) {
        userListBodyEl.innerHTML = '<tr><td colspan="4">Ingen brukere funnet.</td></tr>';
        return;
    }
    users.forEach(user => {
        const userRoles = getRolesForUser(user).map(r => r.RolleNavn).join(', ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.Navn}</td>
            <td>${userRoles}</td>
            <td>${user.Firma}</td>
            <td>${user.Epost} | ${user.Telefon}</td>
        `;
        userListBodyEl.appendChild(tr);
    });
}

/**
 * Renders the Dependencies view for the current user.
 */
function renderDependenciesView() {
     if (!currentUser) {
        waitingForListEl.innerHTML = '<li>Velg en bruker for å se avhengigheter.</li>';
        waitingOnMeListEl.innerHTML = '<li>Velg en bruker for å se avhengigheter.</li>';
        return;
    }

    waitingForListEl.innerHTML = '';
    const myWaitingTasks = tasks.filter(task =>
        currentUser.RolleIDs.includes(task.AnsvarligRolleID) &&
        (task.Status === 'Ikke startet' || task.Status === 'Venter på forutsetning')
    );

    let waitingFound = false;
    myWaitingTasks.forEach(myTask => {
        const unmetPrerequisites = myTask.ForutsetningerIDs.map(findTaskById).filter(preReq => preReq && preReq.Status !== 'Utført');
        if (unmetPrerequisites.length > 0) {
            waitingFound = true;
            const li = document.createElement('li');
            li.innerHTML = `For å starte <strong>${myTask.OppgaveNr}. ${myTask.OppgaveNavn}</strong>, venter du på:
                <ul>${unmetPrerequisites.map(preReq => `<li>${preReq.OppgaveNr}. ${preReq.OppgaveNavn} (Status: ${preReq.Status})</li>`).join('')}</ul>`;
            waitingForListEl.appendChild(li);
        }
    });
    if (!waitingFound) waitingForListEl.innerHTML = '<li>Du venter ikke på noen spesifikke uferdige forutsetninger.</li>';

    waitingOnMeListEl.innerHTML = '';
    const myActiveOrPendingTasks = tasks.filter(task =>
        currentUser.RolleIDs.includes(task.AnsvarligRolleID) &&
        (task.Status !== 'Utført')
    );

    let waitingOnMeFound = false;
    myActiveOrPendingTasks.forEach(myTask => {
        const successorTasksWaiting = tasks.filter(succTask =>
            succTask.ForutsetningerIDs?.includes(myTask.OppgaveID) &&
            (succTask.Status === 'Ikke startet' || succTask.Status === 'Venter på forutsetning')
        );

        if (successorTasksWaiting.length > 0) {
            waitingOnMeFound = true;
            const li = document.createElement('li');
            const successorRoles = [...new Set(successorTasksWaiting.map(st => getRoleById(st.AnsvarligRolleID)?.RolleNavn || 'Ukjent'))];
            li.innerHTML = `Fordi <strong>${myTask.OppgaveNr}. ${myTask.OppgaveNavn}</strong> (Status: ${myTask.Status}) ikke er utført, venter:
                <ul>${successorTasksWaiting.map(st => `<li>${st.OppgaveNr}. ${st.OppgaveNavn} (${getRoleById(st.AnsvarligRolleID)?.RolleNavn || 'Ukjent'})</li>`).join('')}</ul>
                (Roller: ${successorRoles.join(', ')})`;
            waitingOnMeListEl.appendChild(li);
        }
    });
     if (!waitingOnMeFound) waitingOnMeListEl.innerHTML = '<li>Ingen andre oppgaver venter på dine uferdige oppgaver.</li>';
}

/**
 * Renders the simulated messages/notifications list.
 */
 function renderMessages(targetListElement = messageListContainerEl, maxItems = null) {
     if (!targetListElement) return;
    targetListElement.innerHTML = '';

    if (notifications.length === 0) {
        targetListElement.innerHTML = '<li>Ingen meldinger eller varsler.</li>';
        return;
    }

    const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
    const itemsToRender = maxItems ? sortedNotifications.slice(0, maxItems) : sortedNotifications;

    itemsToRender.forEach(notif => {
        const li = document.createElement('li');
        let content = '';
        if (notif.type === 'message') {
             const sender = findUserById(notif.senderId);
             const recipient = findUserById(notif.recipientId);
            content = `<strong>Melding fra: ${sender ? sender.Navn : 'Ukjent'} til ${recipient ? recipient.Navn : 'Ukjent'}</strong>
                       <small>${formatDate(notif.timestamp, true)}</small>
                       <p><em>${notif.subject || '(Intet emne)'}</em></p>
                       <p>${notif.body}</p>`;
        } else if (notif.type === 'system') {
             content = `<strong>Systemvarsel</strong>
                        <small>${formatDate(notif.timestamp, true)}</small>
                        <p>${notif.body}</p>`;
        } else {
             content = `<strong>Ukjent varsel</strong>
                        <small>${formatDate(notif.timestamp, true)}</small>
                        <p>${notif.body}</p>`;
        }
        li.innerHTML = content;
        targetListElement.appendChild(li);
    });
}

/**
 * Renders just the notifications list (used by dashboard and message view).
 */
function renderNotificationsList(targetListElement, maxItems = null) {
     if (!targetListElement) return;
    targetListElement.innerHTML = '';

    if (notifications.length === 0) {
        targetListElement.innerHTML = '<li>Ingen nye hendelser.</li>';
        return;
    }

    const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
    const itemsToRender = maxItems ? sortedNotifications.slice(0, maxItems) : sortedNotifications;

    itemsToRender.forEach(notif => {
        const li = document.createElement('li');
        li.innerHTML = `<small>${formatDate(notif.timestamp, true)}:</small> ${notif.body}`;
         // Add styling for "Klar til start" notifications
         if (notif.body.includes("Arbeidet kan startes")) {
             li.style.backgroundColor = 'var(--status-waiting)'; // Yellowish background
             li.style.borderLeft = '3px solid var(--accent-color)';
         }
        if (notif.taskId) {
            li.style.cursor = 'pointer';
            li.onclick = () => showTaskDetail(notif.taskId);
        }
        targetListElement.appendChild(li);
    });
}

/**
 * Generates the HTML for action buttons in the task detail view
 */
function generateActionButtons(task) {
    let buttonsHtml = '';
    if (!currentUser) return buttonsHtml;

    const isProjectLeader = currentUser.RolleIDs.includes('ROLLE-PL');
    const isResponsibleUser = currentUser.RolleIDs.includes(task.AnsvarligRolleID);

    if (isResponsibleUser) {
        if (task.Status === 'Ikke startet' || task.Status === 'Venter på forutsetning') {
            const canStart = arePrerequisitesMet(task);
            buttonsHtml += `<button class="start-task-button" data-task-id="${task.OppgaveID}" ${!canStart ? 'disabled title="Forutsetninger ikke møtt"' : ''}>Start Arbeid</button>`;
        }
        if (task.Status === 'Pågår') {
             buttonsHtml += `<button class="complete-task-button" data-task-id="${task.OppgaveID}">Marker som Utført (Send til godkjenning)</button>`;
        }
        if (task.Status !== 'Utført' && task.Status !== 'Problem Rapportert') {
             buttonsHtml += `<button class="problem-button" data-task-id="${task.OppgaveID}">Rapporter Problem (Nødbrems)</button>`;
        }
    }

    if (isProjectLeader) {
         if (task.Status === 'Venter på Godkjenning') {
            buttonsHtml += `<button class="approve-button" data-task-id="${task.OppgaveID}">Godkjenn Utført Arbeid</button>`;
            buttonsHtml += `<button class="reject-button" data-task-id="${task.OppgaveID}">Avvis (Send tilbake til 'Pågår')</button>`;
         }
         if (task.Status === 'Problem Rapportert') {
             buttonsHtml += `<button class="resolve-problem-button" data-task-id="${task.OppgaveID}">Marker Problem som Løst</button>`;
         }
    }
    return buttonsHtml;
}

// === 5.3: RENDERING FUNCTIONS END ===


// === 5.4: EVENT HANDLERS START ===

/**
 * Sets up all initial event listeners.
 */
function setupEventListeners() {
    userSelect.addEventListener('change', handleUserChange);
    navButtons.forEach(button => button.addEventListener('click', handleNavClick));
    phaseFilterEl.addEventListener('change', renderFullTaskList);
    statusFilterEl.addEventListener('change', renderFullTaskList);
    backToListButton.addEventListener('click', () => {
         if (!currentUser) return;
        const prevView = currentUser.RolleIDs.includes('ROLLE-PL') ? 'taskList' : 'myTasks';
        switchView(prevView);
        renderApp();
    });
    newMessageButton.addEventListener('click', () => {
        newMessageModal.style.display = 'block';
         messageSubjectEl.value = '';
         messageBodyEl.value = '';
    });
    cancelMessageButton.addEventListener('click', () => newMessageModal.style.display = 'none');
    sendMessageButton.addEventListener('click', handleSendMessage);
    taskDetailContentEl.addEventListener('click', handleTaskDetailClicks);
}

/**
 * Handles clicks within the task detail view using event delegation.
 */
function handleTaskDetailClicks(event) {
     if (!currentUser) return;

    const target = event.target;
    const taskId = target.dataset.taskId;
    const durationInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]');
    const currentTaskInDetailId = durationInput ? durationInput.id.split('_')[1] : null;
    const currentTaskInDetail = currentTaskInDetailId ? findTaskById(currentTaskInDetailId) : null;

    if (target.classList.contains('start-task-button') && taskId) updateTaskStatus(taskId, 'Pågår');
    else if (target.classList.contains('complete-task-button') && taskId) updateTaskStatus(taskId, 'Venter på Godkjenning');
    else if (target.classList.contains('approve-button') && taskId) updateTaskStatus(taskId, 'Utført', { godkjent: true });
    else if (target.classList.contains('reject-button') && taskId) {
        updateTaskStatus(taskId, 'Pågår');
        addNotification('system', `Oppgave ${findTaskById(taskId)?.OppgaveNr} ble avvist av leder og satt tilbake til 'Pågår'.`, null, taskId);
    } else if (target.classList.contains('problem-button') && taskId) reportProblem(taskId);
    else if (target.classList.contains('resolve-problem-button') && taskId) resolveProblem(taskId);
    else if (target.classList.contains('save-duration-button') && taskId) handleSaveDuration(taskId);
    else if (target.id === 'addTaskCommentButton') {
         const commentInput = document.getElementById('taskCommentInput');
         if (commentInput && commentInput.value.trim() !== '' && currentTaskInDetail) {
             addNotification('system', `Notat lagt til Oppgave ${currentTaskInDetail.OppgaveNr}: "${commentInput.value.trim()}"`, currentUser.BrukerID, currentTaskInDetail.OppgaveID);
             commentInput.value = '';
             renderMessages();
             renderNotificationsList(latestNotificationsListEl, 5);
         }
    } else if (target.classList.contains('clickable-user') && target.dataset.userId) {
        const userIdToSwitch = target.dataset.userId;
        const userToSwitch = findUserById(userIdToSwitch);
        if (userToSwitch && currentTaskInDetail) {
            currentUser = userToSwitch;
            userSelect.value = currentUser.BrukerID;
            showTaskDetail(currentTaskInDetail.OppgaveID);
            addNotification('system', `Visning byttet til bruker: ${currentUser.Navn}`, null);
        }
    }
}

/**
 * Handles changes in the global user selector.
 */
function handleUserChange() {
    const selectedUserId = userSelect.value;
    currentUser = findUserById(selectedUserId);
     if (!currentUser) {
        console.error("Selected user not found!");
        return;
    }
    console.log("User changed to:", currentUser.Navn);
    addNotification('system', `Visning byttet til bruker: ${currentUser.Navn}`, null);
    currentView = currentUser.RolleIDs.includes('ROLLE-PL') ? 'dashboard' : 'myTasks';
    renderApp();
}

/**
 * Handles changes in the task detail user selector.
 */
function handleTaskDetailUserChange(event) {
    const selectedUserId = event.target.value;
    const userToSwitch = findUserById(selectedUserId);
    const durationInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]');
    const currentTaskInDetailId = durationInput ? durationInput.id.split('_')[1] : null;

    if (userToSwitch && currentTaskInDetailId) {
        currentUser = userToSwitch;
        userSelect.value = currentUser.BrukerID;
        showTaskDetail(currentTaskInDetailId);
        addNotification('system', `Visning byttet til bruker: ${currentUser.Navn}`, null);
    }
}

/**
 * Handles clicks on the main navigation buttons.
 */
function handleNavClick(event) {
    const targetView = event.target.dataset.targetView;
    if (targetView) {
        currentView = targetView;
        if (projectData && userData) {
            switchView(targetView);
            updateActiveNavButton();
            if (targetView === 'messages') renderMessages();
            if (targetView === 'dependencies') renderDependenciesView();
            if (targetView === 'taskList') renderFullTaskList(); // Ensure list rerenders on nav
            if (targetView === 'myTasks') renderMyTasksList(); // Ensure list rerenders on nav

        } else {
            console.warn("Navigation attempt before data is loaded.");
            const errorMsgElement = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]');
             if (!errorMsgElement) appContent.innerHTML = '<p style="color: orange; padding: 20px;">Data lastes fortsatt...</p>';
        }
    }
}

/**
 * Handles saving the duration for a task.
 */
function handleSaveDuration(taskId) {
    const task = findTaskById(taskId);
    const inputElement = document.getElementById(`durationInput_${taskId}`);
    if (!task || !inputElement) return;
    const newDurationString = inputElement.value;
    const newDuration = newDurationString === '' ? null : parseInt(newDurationString, 10);

    if (newDurationString === '' || (!isNaN(newDuration) && newDuration >= 0)) {
        if (task.EstimertVarighetDager !== newDuration) {
            const oldDuration = task.EstimertVarighetDager;
            task.EstimertVarighetDager = newDuration;
            console.log(`Duration updated for task ${taskId} to ${newDuration === null ? 'null' : newDuration} days.`);
            addNotification('system', `Varighet for Oppgave ${task.OppgaveNr} endret fra ${oldDuration === null ? 'N/A' : oldDuration} til ${newDuration === null ? 'N/A' : newDuration} dager av ${currentUser.Navn}.`, currentUser.BrukerID, taskId);
            recalculateTaskDates(task); // Start recalculation from this task
            renderApp();
            showTaskDetail(taskId); // Refresh detail view
        }
    } else {
        alert("Vennligst skriv inn et gyldig positivt tall for varighet, eller la feltet stå tomt.");
        inputElement.value = task.EstimertVarighetDager !== null ? task.EstimertVarighetDager : '';
    }
}

/**
 * Handles sending a simulated message.
 */
function handleSendMessage() {
     const recipientId = messageRecipientEl.value;
     const subject = messageSubjectEl.value.trim();
     const body = messageBodyEl.value.trim();
     if (!currentUser) { alert("Kan ikke sende melding, ingen bruker er valgt."); return; }
     if (!recipientId || !body) { alert('Vennligst velg mottaker og skriv en melding.'); return; }
     addNotification('message', body, currentUser.BrukerID, null, recipientId, subject);
     newMessageModal.style.display = 'none';
     renderMessages();
     renderNotificationsList(latestNotificationsListEl, 5);
}

/**
 * Attaches event listeners specific to the task detail view elements.
 */
function addTaskDetailEventListeners(task) {
    // Event delegation in handleTaskDetailClicks handles most buttons now.
    // Only add specific listeners if needed, e.g., for non-button interactions.
}

// === 5.4: EVENT HANDLERS END ===


// === 5.5: TASK ACTIONS & LOGIC START ===

/**
 * Updates the status of a task and handles related side effects.
 */
function updateTaskStatus(taskId, newStatus, options = {}) {
    const task = findTaskById(taskId);
    if (!task) return;
    const oldStatus = task.Status;
    if (oldStatus === newStatus && newStatus !== 'Utført') return;

    console.log(`Updating status for task ${taskId}: ${oldStatus} -> ${newStatus}`);
    task.Status = newStatus;
    task.JustMadeReady = false; // Clear the "blink" flag on any status change

    if (newStatus === 'Pågår' && !task.FaktiskStartDato) task.FaktiskStartDato = new Date();
    if (newStatus === 'Pågår') {
        task.GodkjentAvLeder = false;
        task.ProblemBeskrivelse = null;
    }
    if (newStatus === 'Venter på Godkjenning') {
         task.GodkjentAvLeder = false;
         task.ProblemBeskrivelse = null;
    } else if (newStatus === 'Utført') {
        task.FaktiskSluttDato = new Date();
        task.GodkjentAvLeder = options.godkjent || task.GodkjentAvLeder;
        task.ProblemBeskrivelse = null;
        triggerSuccessorUpdate(taskId);
    }

    recalculateDependentTaskDates(task);
    addNotification('system', `Status for Oppgave ${task.OppgaveNr} (${task.OppgaveNavn}) endret til '${newStatus}' av ${currentUser.Navn}.`, currentUser.BrukerID, taskId);
    renderApp();

    if (taskDetailViewEl.classList.contains('active-view')) {
        const durationInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]');
        const currentTaskInDetailId = durationInput ? durationInput.id.split('_')[1] : null;
        if (currentTaskInDetailId === taskId) showTaskDetail(taskId);
    }
}

/**
 * Checks prerequisites for dependent tasks and updates their status if they can now start.
 */
function triggerSuccessorUpdate(completedTaskId) {
    console.log(`Task ${completedTaskId} completed, checking successors...`);
    tasks.forEach(task => {
        if (task.ForutsetningerIDs?.includes(completedTaskId)) {
            if (task.Status === 'Venter på forutsetning' || task.Status === 'Ikke startet') { // Check both initial states
                const wasWaiting = task.Status === 'Venter på forutsetning';
                if (arePrerequisitesMet(task)) {
                    task.Status = 'Ikke startet'; // Mark as ready
                    task.JustMadeReady = wasWaiting; // Flag for "blink" only if it *was* waiting
                    task.BeregnetStartDato = calculateEarliestStartDate(task);
                    addNotification('system', `Oppgave ${task.OppgaveNr} (${task.OppgaveNavn}) er klar til start! Forutsetninger møtt.`, null, task.OppgaveID);
                    recalculateTaskDates(task);
                } else {
                     task.Status = 'Venter på forutsetning'; // Keep waiting if other prerequisites remain
                     task.JustMadeReady = false; // Ensure flag is off
                }
            }
        }
    });
}


/**
 * Checks if all prerequisites for a given task are met (status is 'Utført').
 */
function arePrerequisitesMet(task) {
    if (!task.ForutsetningerIDs || task.ForutsetningerIDs.length === 0) return true;
    return task.ForutsetningerIDs.every(preReqId => {
        const preReqTask = findTaskById(preReqId);
        return preReqTask && preReqTask.Status === 'Utført';
    });
}

/**
 * Recalculates the end date for a task and triggers recalculation for its successors.
 */
function recalculateTaskDates(task) {
    if (!task) return;
    console.log(`Recalculating dates for Task ${task.OppgaveNr}`);
    let changed = false;
    const oldStartDate = task.BeregnetStartDato;
    const oldEndDate = task.BeregnetSluttDato;

    const newStartDate = calculateEarliestStartDate(task);
    if (newStartDate !== null && (!oldStartDate || oldStartDate.getTime() !== newStartDate.getTime())) {
        task.BeregnetStartDato = newStartDate;
        changed = true;
        console.log(`  - Updated Start Date: ${formatDate(task.BeregnetStartDato)}`);
    } else if (newStartDate === null && oldStartDate !== null) {
        task.BeregnetStartDato = null; // Clear if cannot be calculated
        changed = true;
         console.log(`  - Cleared Start Date`);
    }


    if (task.BeregnetStartDato && task.EstimertVarighetDager !== null) {
        const newEndDate = addWorkDays(task.BeregnetStartDato, task.EstimertVarighetDager);
         if (newEndDate !== null && (!oldEndDate || oldEndDate.getTime() !== newEndDate.getTime())) {
            task.BeregnetSluttDato = newEndDate;
            changed = true;
            console.log(`  - Updated End Date: ${formatDate(task.BeregnetSluttDato)}`);
        } else if (newEndDate === null && oldEndDate !== null) {
            task.BeregnetSluttDato = null;
            changed = true;
             console.log(`  - Cleared End Date (due to addWorkDays failure)`);
        }
    } else {
        if (oldEndDate !== null) {
            task.BeregnetSluttDato = null;
            changed = true;
            console.log(`  - Cleared End Date (due to missing start/duration)`);
        }
    }

    if (changed) recalculateDependentTaskDates(task);
}

/**
 * Recalculates dates for tasks that depend on the provided task.
 */
function recalculateDependentTaskDates(prerequisiteTask) {
    const successorTasks = tasks.filter(t => t.ForutsetningerIDs?.includes(prerequisiteTask.OppgaveID));
    console.log(`  - Found ${successorTasks.length} successors for Task ${prerequisiteTask.OppgaveNr}. Triggering recalculation...`);
    successorTasks.forEach(succTask => recalculateTaskDates(succTask));
}


/**
 * Calculates the earliest possible start date for a task based on its prerequisites' completion dates.
 */
 function calculateEarliestStartDate(task) {
    if (!task.ForutsetningerIDs || task.ForutsetningerIDs.length === 0) {
        const projectStartDate = projectData?.project?.StartDato ? new Date(projectData.project.StartDato) : new Date();
        projectStartDate.setHours(0, 0, 0, 0);
        return projectStartDate;
    }
    let latestPrerequisiteEndDate = null;
    let prerequisitesReady = true;
    for (const preReqId of task.ForutsetningerIDs) {
        const preReqTask = findTaskById(preReqId);
        if (preReqTask) {
            if (preReqTask.Status !== 'Utført') prerequisitesReady = false;
            const endDate = preReqTask.FaktiskSluttDato || preReqTask.BeregnetSluttDato;
            if (endDate && endDate instanceof Date && !isNaN(endDate)) {
                if (!latestPrerequisiteEndDate || endDate > latestPrerequisiteEndDate) latestPrerequisiteEndDate = endDate;
            } else { return null; } // Cannot calculate if prerequisite end date is missing
        } else { return null; } // Cannot calculate if prerequisite task is missing
    }
    if (latestPrerequisiteEndDate) {
        const nextDay = new Date(latestPrerequisiteEndDate);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        const projectStartDate = projectData?.project?.StartDato ? new Date(projectData.project.StartDato) : new Date(1970, 0, 1);
        projectStartDate.setHours(0, 0, 0, 0);
        return nextDay > projectStartDate ? nextDay : projectStartDate;
    }
    return null;
}

/**
 * Simulates reporting a problem for a task.
 */
function reportProblem(taskId) {
    const task = findTaskById(taskId);
    if (!task || task.Status === 'Utført' || !currentUser) return;
    const reason = prompt(`Beskriv problemet for oppgave ${task.OppgaveNr} (${task.OppgaveNavn}):`, task.ProblemBeskrivelse || '');
    if (reason !== null) {
        task.ProblemBeskrivelse = reason.trim() || "Problem rapportert";
        updateTaskStatus(taskId, 'Problem Rapportert');
        addNotification('system', `Problem rapportert for Oppgave ${task.OppgaveNr} av ${currentUser.Navn}: "${task.ProblemBeskrivelse}"`, currentUser.BrukerID, taskId);
    }
}

/**
 * Simulates resolving a problem for a task (Project Leader action).
 */
function resolveProblem(taskId) {
    const task = findTaskById(taskId);
    if (!task || task.Status !== 'Problem Rapportert' || !currentUser) return;
    let statusBeforeProblem = 'Pågår';
    if (task.FaktiskStartDato === null) {
         statusBeforeProblem = arePrerequisitesMet(task) ? 'Ikke startet' : 'Venter på forutsetning';
    }
    task.ProblemBeskrivelse = null;
    updateTaskStatus(taskId, statusBeforeProblem);
    addNotification('system', `Problem for Oppgave ${task.OppgaveNr} markert som løst av ${currentUser.Navn}. Status satt til '${statusBeforeProblem}'.`, currentUser.BrukerID, taskId);
}

/**
 * Admin action to mark a task as fully complete, bypassing normal workflow.
 */
 function adminMarkTaskComplete(taskId) {
    const task = findTaskById(taskId);
    if (!task || !currentUser || !currentUser.RolleIDs.includes('ROLLE-PL')) return;
    console.log(`Admin marking task ${taskId} as complete.`);
    if (!task.FaktiskStartDato) task.FaktiskStartDato = new Date();
    if (!task.FaktiskSluttDato) task.FaktiskSluttDato = new Date();
    task.Status = 'Utført';
    task.GodkjentAvLeder = true;
    task.ProblemBeskrivelse = null;
    addNotification('system', `Oppgave ${task.OppgaveNr} hurtigfullført av Admin (${currentUser.Navn}).`, currentUser.BrukerID, taskId);
    triggerSuccessorUpdate(taskId);
    recalculateDependentTaskDates(task);
    renderApp();
    if (taskDetailViewEl.classList.contains('active-view')) {
        const durationInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]');
        const currentTaskInDetailId = durationInput ? durationInput.id.split('_')[1] : null;
        if (currentTaskInDetailId === taskId) showTaskDetail(taskId);
    }
}

/**
 * Determines if the current user can edit the duration of a task.
 */
function canEditDuration(task) {
    if (!currentUser) return false;
    const isProjectLeader = currentUser.RolleIDs.includes('ROLLE-PL');
    const isResponsibleUser = currentUser.RolleIDs.includes(task.AnsvarligRolleID);
    return (isProjectLeader || isResponsibleUser) && task.Status !== 'Utført';
}

/**
 * Gets a list of pending actions for a specific user.
 * @param {object} user - The user object.
 * @returns {Array<object>} - Array of action objects { type: string, task: object }.
 */
 function getPendingActionsForUser(user) {
    if (!user) return [];
    const actions = [];
    const isProjectLeader = user.RolleIDs.includes('ROLLE-PL');

    tasks.forEach(task => {
        const isResponsible = user.RolleIDs.includes(task.AnsvarligRolleID);

        // Action: Start Task
        if (isResponsible && task.Status === 'Ikke startet' && arePrerequisitesMet(task)) {
            actions.push({ type: 'Start Oppgave', task: task });
        }

        // Action: Approve Task
        if (isProjectLeader && task.Status === 'Venter på Godkjenning') {
            actions.push({ type: 'Godkjenn Oppgave', task: task });
        }

        // Action: Resolve Problem
        if (isProjectLeader && task.Status === 'Problem Rapportert') {
             actions.push({ type: 'Løs Problem', task: task });
        }
         // Action: Report Problem (Maybe less of a pending action, more of a possible action?)
         // We can add it if needed, but the button exists in the detail view.
    });

     // Sort actions (e.g., approvals/problems first, then tasks to start)
     actions.sort((a, b) => {
        const typeOrder = {
            "Løs Problem": 1,
            "Godkjenn Oppgave": 2,
            "Start Oppgave": 3
        };
        return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
     });

    return actions;
}


// === 5.5: TASK ACTIONS & LOGIC END ===


// === 5.6: UTILITY FUNCTIONS START ===

/**
 * Finds a task object by its ID.
 */
function findTaskById(taskId) {
     if (!tasks) return undefined;
    return tasks.find(task => task.OppgaveID === taskId);
}

/**
 * Finds a user object by its ID.
 */
function findUserById(userId) {
    if (!users) return undefined;
    return users.find(user => user.BrukerID === userId);
}

/**
 * Finds a role object by its ID.
 */
function getRoleById(roleId) {
    if (!roles) return undefined;
    return roles.find(role => role.RolleID === roleId);
}

/**
 * Finds all users associated with a given role ID.
 */
function findUsersByRole(roleId) {
    if (!users) return [];
    return users.filter(user => user.RolleIDs.includes(roleId));
}


/**
 * Gets all role objects associated with a given user.
 */
 function getRolesForUser(user) {
     if (!user || !user.RolleIDs || !roles) return [];
     return user.RolleIDs.map(roleId => getRoleById(roleId)).filter(role => role);
 }


/**
 * Formats a Date object into a readable string (DD.MM.YYYY).
 */
function formatDate(date, includeTime = false) {
    if (!date || !(date instanceof Date) || isNaN(date)) return 'N/A';
    try {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        let formatted = `${day}.${month}.${year}`;
        if (includeTime) {
             const hours = String(date.getHours()).padStart(2, '0');
             const minutes = String(date.getMinutes()).padStart(2, '0');
             formatted += ` ${hours}:${minutes}`;
        }
        return formatted;
     } catch (e) { console.error("Error formatting date:", date, e); return 'Feil dato'; }
}

/**
 * Adds a number of work days (Mon-Fri) to a date.
 */
function addWorkDays(startDate, days) {
    if (!startDate || !(startDate instanceof Date) || isNaN(startDate) || days === null || isNaN(days) || days < 0) {
         console.warn("Invalid input to addWorkDays:", startDate, days); return null;
    }
    let currentDate = new Date(startDate);
    let addedDays = 0;
    let safetyCounter = 0;
    while (addedDays < days && safetyCounter < (days * 3 + 100)) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) addedDays++;
        safetyCounter++;
    }
    if (safetyCounter >= (days * 3 + 100)) { console.error("addWorkDays safety counter triggered"); return null; }
     currentDate.setHours(0,0,0,0);
    return currentDate;
}


/**
 * Calculates the overall project progress percentage.
 */
function calculateProjectProgress() {
    if (!tasks || tasks.length === 0) return 0;
    const completedTasks = tasks.filter(task => task.Status === 'Utført').length;
    return Math.round((completedTasks / tasks.length) * 100);
}

/**
 * Calculates a rough project Estimated Time of Arrival (ETA).
 */
function calculateProjectEta() {
     if (!tasks || tasks.length === 0) return 'Ukjent';
    let latestEndDate = null;
    tasks.forEach(task => {
        const endDate = task.BeregnetSluttDato;
        if (endDate && endDate instanceof Date && !isNaN(endDate)) {
            if (!latestEndDate || endDate > latestEndDate) latestEndDate = endDate;
        }
    });
    return latestEndDate ? formatDate(latestEndDate) : 'Ukjent';
}

/**
 * Adds a notification/message to the global list.
 */
function addNotification(type, body, senderId = null, taskId = null, recipientId = null, subject = null) {
    const notification = {
        id: `notif-${Date.now()}-${Math.random()}`, type, body, senderId, recipientId, subject, taskId, timestamp: new Date(), read: false
    };
    notifications.push(notification);
    console.log("Notification added:", notification);
    if (latestNotificationsListEl) renderNotificationsList(latestNotificationsListEl, 5);
    if (messageListContainerEl && currentView === 'messages') renderMessages();
}


// === 5.6: UTILITY FUNCTIONS END ===


// === 5.7: VIEW MANAGEMENT START ===

/**
 * Switches the active view displayed in the main content area.
 */
function switchView(viewId) {
    console.log("Switching view to:", viewId);
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active-view'));
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active-view');
        currentView = viewId;
    } else {
        console.error(`View with ID ${viewId} not found! Falling back to dashboard.`);
        const dashboardView = document.getElementById('dashboard');
        if (dashboardView) {
            dashboardView.classList.add('active-view');
            currentView = 'dashboard';
        } else {
             appContent.innerHTML = `<p style="color: red; padding: 20px;">FEIL: Finner ingen visninger!</p>`;
        }
    }
}

/**
 * Updates the visual style of the active navigation button.
 */
function updateActiveNavButton() {
    navButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.targetView === currentView);
    });
}

// === 5.7: VIEW MANAGEMENT END ===


// === 5.8: APPLICATION STARTUP ===
// Add event listener to run init when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', init);
// === 5.8: APPLICATION STARTUP END ===

// === 5.9: CSS Blinking Animation START ===
// Inject CSS animation rule for the blinking effect
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
@keyframes blinkBackground {
  0%, 100% { background-color: inherit; } /* Start/end with normal background */
  50% { background-color: var(--status-waiting); } /* Blink color */
}
`;
document.head.appendChild(styleSheet);
// === 5.9: CSS Blinking Animation END ===

// === 5: MAIN APPLICATION SCRIPT END ===
