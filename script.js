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
// Note: pendingActionsListEl reference is obtained inside renderPendingActions now
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
 */
function removeJsonComments(jsonString) {
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
            let errorMsg = 'Kunne ikke laste prosjektdata. ';
            if (!projectResponse.ok) errorMsg += `Feil ved henting av project_data.json (Status: ${projectResponse.status}). `;
            if (!userResponse.ok) errorMsg += `Feil ved henting av users_roles.json (Status: ${userResponse.status}).`;
            throw new Error(errorMsg);
        }

        const projectText = await projectResponse.text();
        const userText = await userResponse.text();

        projectData = JSON.parse(removeJsonComments(projectText));
        userData = JSON.parse(removeJsonComments(userText));

        console.log("Data loaded and parsed successfully:", { projectData, userData });
        processLoadedData();

    } catch (error) {
        console.error('Error loading or parsing data:', error);
        let displayError = 'Kunne ikke laste prosjektdata. ';
        if (error instanceof SyntaxError) {
            displayError += 'Det er en feil i formatet til en av JSON-filene. Sjekk at alle nøkler og strenger er i doble anførselstegn og at det ikke er kommentarer. Sjekk konsollen for detaljer.';
        } else {
            displayError += ` (${error.message}). Sjekk at filene er tilgjengelige og korrekt formatert.`;
        }
         appContent.innerHTML = `<p style="color: red; padding: 20px;">${displayError}</p>`;
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
        JustMadeReady: false
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
         userSelect.innerHTML = '<option value="">Ingen brukere</option>'; return;
    }
    userSelect.innerHTML = '';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.BrukerID;
        option.textContent = `${user.Navn} (${getRolesForUser(user).map(r => r.RolleNavn).join(', ')})`;
        userSelect.appendChild(option);
    });
    if (currentUser) userSelect.value = currentUser.BrukerID;
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
    if (!users || !messageRecipientEl) return; // Added check for element existence
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
    tasks.forEach(task => task.BeregnetStartDato = calculateEarliestStartDate(task));
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
    setupDashboardCards();
    await loadData();
    if (projectData && userData) renderApp();
    else console.log("Initialization halted due to data loading failure.");
}

/**
 * Dynamically adds the 'Pending Actions' card structure to the dashboard grid.
 */
function setupDashboardCards() {
    const dashboardGrid = document.querySelector('#dashboard .dashboard-grid');
    if (!dashboardGrid) return;
    if (!document.getElementById('pendingActionsCard')) {
        const pendingActionsCard = document.createElement('div');
        pendingActionsCard.classList.add('card', 'card-pending-actions'); // Add specific class
        pendingActionsCard.id = 'pendingActionsCard';
        pendingActionsCard.innerHTML = `
            <h3>Handlinger Kreves <span class="action-count"></span></h3>
            <ul id="pendingActionsList"><li>Laster...</li></ul>`;
        const activeTasksCard = document.getElementById('activeTasksCard');
        if (activeTasksCard) dashboardGrid.insertBefore(pendingActionsCard, activeTasksCard.nextSibling);
        else dashboardGrid.appendChild(pendingActionsCard);
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
             appContent.innerHTML = '<p style="color: orange; padding: 20px;">Kan ikke vise data...</p>';
        }
        return;
    }
    const errorMsgElement = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]');
    if (errorMsgElement) errorMsgElement.remove();

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
    if (!projectData || !tasks) return; // Added tasks check
    projectStatusEl.textContent = projectData.project.Status;
    projectEtaEl.textContent = calculateProjectEta();
    const progress = calculateProjectProgress();
    progressBarEl.style.width = `${progress}%`;
    progressPercentageEl.textContent = progress;

    const activeTasks = tasks.filter(task => task.Status === 'Pågår');
    activeTasksListEl.innerHTML = '';
    if (activeTasks.length === 0) activeTasksListEl.innerHTML = '<li>Ingen aktive oppgaver</li>';
    else {
        activeTasks.slice(0, 5).forEach(task => {
            const li = document.createElement('li');
            const role = getRoleById(task.AnsvarligRolleID);
            li.innerHTML = `<strong style="cursor: pointer;">${task.OppgaveNr}. ${task.OppgaveNavn}</strong> (${role ? role.RolleNavn : 'Ukjent'})`;
            li.querySelector('strong').onclick = () => showTaskDetail(task.OppgaveID);
            activeTasksListEl.appendChild(li);
        });
    }
    renderPendingActions();
    renderNotificationsList(latestNotificationsListEl, 5);
}

/**
 * Renders the "Pending Actions" card on the dashboard with enhanced visibility.
 */
 function renderPendingActions() {
    const pendingActionsListEl = document.getElementById('pendingActionsList');
    const actionCountSpan = document.querySelector('#pendingActionsCard .action-count');
    const pendingActionsCard = document.getElementById('pendingActionsCard'); // Get card element

    if (!pendingActionsListEl || !actionCountSpan || !pendingActionsCard) {
        console.error("Missing elements for pending actions card.");
        return;
    }

    const actions = getPendingActionsForUser(currentUser);
    pendingActionsListEl.innerHTML = ''; // Clear list

    if (actions.length === 0) {
        pendingActionsListEl.innerHTML = '<li>Ingen handlinger kreves.</li>';
        actionCountSpan.textContent = '';
        pendingActionsCard.classList.remove('has-actions'); // Remove highlight class
    } else {
        actionCountSpan.textContent = `(${actions.length})`;
        pendingActionsCard.classList.add('has-actions'); // Add highlight class

        actions.slice(0, 5).forEach((action, index) => {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.onclick = () => showTaskDetail(action.task.OppgaveID);

            let prefix = '';
            let itemClass = '';
             let highlightStyle = '';

            switch (action.type) {
                case 'Løs Problem':
                    prefix = `<span class="action-icon problem">❗</span> Problem:`;
                    itemClass = 'action-problem';
                    break;
                case 'Godkjenn Oppgave':
                    prefix = `<span class="action-icon approval">⚠️</span> Godkjenning:`;
                    itemClass = 'action-approval';
                    break;
                case 'Start Oppgave':
                    prefix = `<span class="action-icon start">✅</span> Klar til start:`;
                    itemClass = 'action-start';
                     if (action.task.JustMadeReady) {
                        highlightStyle = 'background-color: var(--status-waiting); animation: blinkBackground 1.5s ease-in-out 2;'; // Apply blink style directly
                     }
                    break;
                default:
                    prefix = 'Handling:';
            }

             // Apply highlight style and add class
             li.style.cssText = highlightStyle; // Use cssText to overwrite previous styles if needed
             li.classList.add(itemClass);


            // Add extra emphasis to the very first (highest priority) action
            if (index === 0) {
                li.classList.add('highest-priority-action');
                prefix = `<strong>${prefix}</strong>`; // Make prefix bold
            }


            li.innerHTML = `${prefix} ${action.task.OppgaveNr}. ${action.task.OppgaveNavn}`;
            pendingActionsListEl.appendChild(li);

            // Reset the 'JustMadeReady' flag after displaying it once
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
    if (!tasks) return; // Guard
    const phaseFilter = phaseFilterEl.value;
    const statusFilter = statusFilterEl.value;
    const filteredTasks = tasks.filter(task =>
        (phaseFilter === 'all' || task.Fase === phaseFilter) &&
        (statusFilter === 'all' || task.Status === statusFilter)
    );
    fullTaskListContainerEl.innerHTML = '';
    if (filteredTasks.length === 0) {
        fullTaskListContainerEl.innerHTML = '<p>Ingen oppgaver matcher filtrene.</p>'; return;
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
    if (!currentUser || !tasks) { // Guard
        myTasksListContainerEl.innerHTML = '<p>Velg en bruker for å se deres oppgaver.</p>'; return;
    }
    const isProjectLeader = currentUser.RolleIDs.includes('ROLLE-PL');
    const myTasks = tasks.filter(task =>
        currentUser.RolleIDs.includes(task.AnsvarligRolleID) ||
        (isProjectLeader && task.Status === 'Venter på Godkjenning')
    );
    myTasksListContainerEl.innerHTML = '';
    if (myTasks.length === 0) {
        myTasksListContainerEl.innerHTML = '<p>Ingen relevante oppgaver.</p>'; return;
    }
    myTasks.sort((a, b) => { /* ... (sorting logic remains the same) ... */
        const statusOrder = { "Problem Rapportert": 1, "Venter på Godkjenning": 2, "Pågår": 3, "Ikke startet": 4, "Venter på forutsetning": 5, "Utført": 6 };
        const effectiveStatusA = (isProjectLeader && a.Status === 'Venter på Godkjenning') ? 'Venter på Godkjenning' : a.Status;
        const effectiveStatusB = (isProjectLeader && b.Status === 'Venter på Godkjenning') ? 'Venter på Godkjenning' : b.Status;
        const orderA = statusOrder[effectiveStatusA] || 99;
        const orderB = statusOrder[effectiveStatusB] || 99;
        if (orderA !== orderB) return orderA - orderB;
        const dateA = a.BeregnetStartDato || new Date('9999-12-31');
        const dateB = b.BeregnetStartDato || new Date('9999-12-31');
        const dateAIsValid = dateA instanceof Date && !isNaN(dateA);
        const dateBIsValid = dateB instanceof Date && !isNaN(dateB);
        if (dateAIsValid && dateBIsValid) { if (dateA.getTime() !== dateB.getTime()) return dateA - dateB; }
        else if (dateAIsValid) return -1;
        else if (dateBIsValid) return 1;
        return a.OppgaveNr - b.OppgaveNr;
    });
    myTasks.forEach(task => myTasksListContainerEl.appendChild(createTaskElement(task, false, isProjectLeader)));
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

    const approvalCue = (isViewerProjectLeader && task.Status === 'Venter på Godkjenning') ? `<strong class="cue cue-approval">⚠️ Til Godkjenning</strong>` : '';
    const problemCue = (task.Status === 'Problem Rapportert') ? `<strong class="cue cue-problem">❗ Problem (${task.ProblemBeskrivelse || 'rapportert'})</strong>` : '';
    const readyToStartCue = (task.Status === 'Ikke startet' && arePrerequisitesMet(task) && currentUser?.RolleIDs.includes(task.AnsvarligRolleID)) ? `<strong class="cue cue-ready">✅ Klar til start!</strong>` : '';

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
            ${isAdminView && isViewerProjectLeader && task.Status !== 'Utført' ? '<button class="admin-complete-button" title="Admin: Hurtigfullfør">⚡ Fullfør</button>' : ''}
        </div>
    `;

    taskElement.querySelector('.details-button').addEventListener('click', (e) => { e.stopPropagation(); showTaskDetail(task.OppgaveID); });
    const adminCompleteButton = taskElement.querySelector('.admin-complete-button');
    if (adminCompleteButton) adminCompleteButton.addEventListener('click', (e) => { e.stopPropagation(); adminMarkTaskComplete(task.OppgaveID); });

    // Apply blink directly if needed, as CSS class might be overridden by status color
     if (task.JustMadeReady && task.Status === 'Ikke startet') {
         taskElement.style.animation = 'blinkBackground 1.5s ease-in-out 2';
          // task.JustMadeReady = false; // Reset flag after applying animation? Maybe better on dashboard render.
     } else {
          taskElement.style.animation = 'none'; // Ensure animation stops if flag is false
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
    if (task.ForutsetningerIDs?.length > 0) {
        prerequisitesHtml = '<ul>' + task.ForutsetningerIDs.map(id => {
            const pt = findTaskById(id); return pt ? `<li>${pt.Status === 'Utført' ? '✅' : '⚪'} ${pt.OppgaveNr}. ${pt.OppgaveNavn} (${pt.Status})</li>` : `<li>Ukjent ID: ${id}</li>`;
        }).join('') + '</ul>';
    }
    let successorsHtml = 'Ingen';
    const successorTasks = tasks.filter(t => t.ForutsetningerIDs?.includes(task.OppgaveID));
    if (successorTasks.length > 0) successorsHtml = '<ul>' + successorTasks.map(st => `<li>${st.OppgaveNr}. ${st.OppgaveNavn} (${st.Status})</li>`).join('') + '</ul>';
    taskDetailContentEl.innerHTML = `<h3>Generell Info</h3><p><strong>Fase:</strong> ${task.Fase}</p><p><strong>Beskrivelse:</strong> ${task.Beskrivelse || 'Ingen.'}</p><p><strong>Ansvarlig Rolle:</strong> ${responsibleRole?.RolleNavn || 'Ukjent'}</p><p><strong>Ansvarlig(e) Bruker(e):</strong> ${responsibleUsers.map(u => `<span class="clickable-user" data-user-id="${u.BrukerID}">${u.Navn}</span>`).join(', ') || 'Ingen'}</p><h3>Status & Tidsplan</h3><p><strong>Status:</strong> ${task.Status}</p>${task.Status === 'Problem Rapportert' ? `<p style="color:var(--status-problem)"><strong>Problem:</strong> ${task.ProblemBeskrivelse || 'Problem'}</p>` : ''}${task.Status === 'Venter på Godkjenning' ? `<p style="color:var(--status-pending-approval)"><strong>Venter på ledergodkjenning.</strong></p>` : ''}<p><strong>Est. Varighet:</strong> <input type="number" id="durationInput_${task.OppgaveID}" value="${task.EstimertVarighetDager ?? ''}" min="0" step="1" ${canEditDuration(task) ? '' : 'disabled'} style="width: 60px; margin-left: 5px;"> dager ${canEditDuration(task) ? `<button class="save-duration-button" data-task-id="${task.OppgaveID}">Lagre</button>` : ''}</p><p><strong>Beregnet Start:</strong> ${formatDate(task.BeregnetStartDato)}</p><p><strong>Beregnet Slutt:</strong> ${formatDate(task.BeregnetSluttDato)}</p><p><strong>Faktisk Start:</strong> ${formatDate(task.FaktiskStartDato)}</p><p><strong>Faktisk Slutt:</strong> ${formatDate(task.FaktiskSluttDato)}</p><div class="task-detail-actions">${generateActionButtons(task)}</div><h3>Avhengigheter</h3><p><strong>Forutsetninger:</strong></p>${prerequisitesHtml}<p><strong>Etterfølgende:</strong></p>${successorsHtml}<h3>Kommunikasjon</h3><textarea id="taskCommentInput" placeholder="Legg til notat..."></textarea><button id="addTaskCommentButton">Legg til Notat</button><ul id="taskCommentsList"><li>Ingen notater.</li></ul><div class="user-selector task-detail-user-selector" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--gray-medium);"><label for="taskDetailUserSelect">Vis som:</label><select id="taskDetailUserSelect"></select></div>`;
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
    if (currentUser) taskDetailSelect.value = currentUser.BrukerID;
    taskDetailSelect.removeEventListener('change', handleTaskDetailUserChange);
    taskDetailSelect.addEventListener('change', handleTaskDetailUserChange);
}

/**
 * Renders the user list table.
 */
function renderUserList() {
    userListBodyEl.innerHTML = '';
    if (!users || users.length === 0) { userListBodyEl.innerHTML = '<tr><td colspan="4">Ingen brukere.</td></tr>'; return; }
    users.forEach(user => {
        const userRoles = getRolesForUser(user).map(r => r.RolleNavn).join(', ');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${user.Navn}</td><td>${userRoles}</td><td>${user.Firma}</td><td>${user.Epost} | ${user.Telefon}</td>`;
        userListBodyEl.appendChild(tr);
    });
}

/**
 * Renders the Dependencies view for the current user.
 */
function renderDependenciesView() {
     if (!currentUser || !tasks) { // Guard
        waitingForListEl.innerHTML = '<li>Velg bruker.</li>'; waitingOnMeListEl.innerHTML = '<li>Velg bruker.</li>'; return;
    }
    waitingForListEl.innerHTML = '';
    const myWaitingTasks = tasks.filter(t => currentUser.RolleIDs.includes(t.AnsvarligRolleID) && (t.Status === 'Ikke startet' || t.Status === 'Venter på forutsetning'));
    let waitingFound = false;
    myWaitingTasks.forEach(myTask => {
        const unmet = myTask.ForutsetningerIDs.map(findTaskById).filter(p => p && p.Status !== 'Utført');
        if (unmet.length > 0) {
            waitingFound = true;
            const li = document.createElement('li');
            li.innerHTML = `For <strong>${myTask.OppgaveNr}. ${myTask.OppgaveNavn}</strong>, venter på: <ul>${unmet.map(p => `<li>${p.OppgaveNr}. ${p.OppgaveNavn} (${p.Status})</li>`).join('')}</ul>`;
            waitingForListEl.appendChild(li);
        }
    });
    if (!waitingFound) waitingForListEl.innerHTML = '<li>Ingen uferdige forutsetninger.</li>';

    waitingOnMeListEl.innerHTML = '';
    const myActive = tasks.filter(t => currentUser.RolleIDs.includes(t.AnsvarligRolleID) && t.Status !== 'Utført');
    let waitingOnMeFound = false;
    myActive.forEach(myTask => {
        const successors = tasks.filter(st => st.ForutsetningerIDs?.includes(myTask.OppgaveID) && (st.Status === 'Ikke startet' || st.Status === 'Venter på forutsetning'));
        if (successors.length > 0) {
            waitingOnMeFound = true;
            const li = document.createElement('li');
            const roles = [...new Set(successors.map(st => getRoleById(st.AnsvarligRolleID)?.RolleNavn || '?'))];
            li.innerHTML = `Fordi <strong>${myTask.OppgaveNr}. ${myTask.OppgaveNavn}</strong> (${myTask.Status}) ikke er utført, venter: <ul>${successors.map(st => `<li>${st.OppgaveNr}. ${st.OppgaveNavn} (${getRoleById(st.AnsvarligRolleID)?.RolleNavn || '?'})</li>`).join('')}</ul> (Roller: ${roles.join(', ')})`;
            waitingOnMeListEl.appendChild(li);
        }
    });
     if (!waitingOnMeFound) waitingOnMeListEl.innerHTML = '<li>Ingen oppgaver venter på dine.</li>';
}

/**
 * Renders the simulated messages/notifications list.
 */
 function renderMessages(targetListElement = messageListContainerEl, maxItems = null) {
     if (!targetListElement) return;
    targetListElement.innerHTML = '';
    if (notifications.length === 0) { targetListElement.innerHTML = '<li>Ingen meldinger/varsler.</li>'; return; }
    const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
    const items = maxItems ? sorted.slice(0, maxItems) : sorted;
    items.forEach(n => {
        const li = document.createElement('li');
        let content = '';
        if (n.type === 'message') {
            const s = findUserById(n.senderId), r = findUserById(n.recipientId);
            content = `<strong>Melding fra: ${s?.Navn || '?'} til ${r?.Navn || '?'}</strong><small>${formatDate(n.timestamp, true)}</small><p><em>${n.subject || '(Uten emne)'}</em></p><p>${n.body}</p>`;
        } else content = `<strong>Systemvarsel</strong><small>${formatDate(n.timestamp, true)}</small><p>${n.body}</p>`;
        li.innerHTML = content; targetListElement.appendChild(li);
    });
}

/**
 * Renders just the notifications list.
 */
function renderNotificationsList(targetListElement, maxItems = null) {
     if (!targetListElement) return;
    targetListElement.innerHTML = '';
    if (notifications.length === 0) { targetListElement.innerHTML = '<li>Ingen nye hendelser.</li>'; return; }
    const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
    const items = maxItems ? sorted.slice(0, maxItems) : sorted;
    items.forEach(n => {
        const li = document.createElement('li');
        li.innerHTML = `<small>${formatDate(n.timestamp, true)}:</small> ${n.body}`;
        if (n.body.includes("klar til start")) { li.style.backgroundColor = 'var(--status-waiting)'; li.style.borderLeft = '3px solid var(--accent-color)'; }
        if (n.taskId) { li.style.cursor = 'pointer'; li.onclick = () => showTaskDetail(n.taskId); }
        targetListElement.appendChild(li);
    });
}

/**
 * Generates the HTML for action buttons in the task detail view
 */
function generateActionButtons(task) {
    let buttonsHtml = ''; if (!currentUser) return buttonsHtml;
    const isPL = currentUser.RolleIDs.includes('ROLLE-PL');
    const isResp = currentUser.RolleIDs.includes(task.AnsvarligRolleID);
    if (isResp) {
        if (task.Status === 'Ikke startet' || task.Status === 'Venter på forutsetning') {
            const canStart = arePrerequisitesMet(task);
            buttonsHtml += `<button class="start-task-button" data-task-id="${task.OppgaveID}" ${!canStart ? 'disabled title="Forutsetninger ikke møtt"' : ''}>Start Arbeid</button>`;
        }
        if (task.Status === 'Pågår') buttonsHtml += `<button class="complete-task-button" data-task-id="${task.OppgaveID}">Marker Utført (Send til godkjenning)</button>`;
        if (task.Status !== 'Utført' && task.Status !== 'Problem Rapportert') buttonsHtml += `<button class="problem-button" data-task-id="${task.OppgaveID}">Rapporter Problem</button>`;
    }
    if (isPL) {
         if (task.Status === 'Venter på Godkjenning') {
            buttonsHtml += `<button class="approve-button" data-task-id="${task.OppgaveID}">Godkjenn Utført</button><button class="reject-button" data-task-id="${task.OppgaveID}">Avvis</button>`;
         }
         if (task.Status === 'Problem Rapportert') buttonsHtml += `<button class="resolve-problem-button" data-task-id="${task.OppgaveID}">Marker Problem Løst</button>`;
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
    backToListButton.addEventListener('click', () => { if (!currentUser) return; const v = currentUser.RolleIDs.includes('ROLLE-PL') ? 'taskList' : 'myTasks'; switchView(v); renderApp(); });
    newMessageButton.addEventListener('click', () => { newMessageModal.style.display = 'block'; messageSubjectEl.value = ''; messageBodyEl.value = ''; });
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
    else if (target.classList.contains('reject-button') && taskId) { updateTaskStatus(taskId, 'Pågår'); addNotification('system', `Oppg ${findTaskById(taskId)?.OppgaveNr} avvist, satt til 'Pågår'.`, null, taskId); }
    else if (target.classList.contains('problem-button') && taskId) reportProblem(taskId);
    else if (target.classList.contains('resolve-problem-button') && taskId) resolveProblem(taskId);
    else if (target.classList.contains('save-duration-button') && taskId) handleSaveDuration(taskId);
    else if (target.id === 'addTaskCommentButton') {
         const commentInput = document.getElementById('taskCommentInput');
         if (commentInput?.value.trim() && currentTaskInDetail) { addNotification('system', `Notat til Oppg ${currentTaskInDetail.OppgaveNr}: "${commentInput.value.trim()}"`, currentUser.BrukerID, currentTaskInDetail.OppgaveID); commentInput.value = ''; renderMessages(); renderNotificationsList(latestNotificationsListEl, 5); }
    } else if (target.classList.contains('clickable-user') && target.dataset.userId) {
        const user = findUserById(target.dataset.userId);
        if (user && currentTaskInDetail) { currentUser = user; userSelect.value = user.BrukerID; showTaskDetail(currentTaskInDetail.OppgaveID); addNotification('system', `Visning byttet til: ${user.Navn}`, null); }
    }
}

/**
 * Handles changes in the global user selector.
 */
function handleUserChange() {
    currentUser = findUserById(userSelect.value);
    if (!currentUser) { console.error("Selected user not found!"); return; }
    console.log("User changed to:", currentUser.Navn);
    addNotification('system', `Visning byttet til: ${currentUser.Navn}`, null);
    currentView = currentUser.RolleIDs.includes('ROLLE-PL') ? 'dashboard' : 'myTasks';
    renderApp();
}

/**
 * Handles changes in the task detail user selector.
 */
function handleTaskDetailUserChange(event) {
    const user = findUserById(event.target.value);
    const durationInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]');
    const taskId = durationInput ? durationInput.id.split('_')[1] : null;
    if (user && taskId) { currentUser = user; userSelect.value = user.BrukerID; showTaskDetail(taskId); addNotification('system', `Visning byttet til: ${user.Navn}`, null); }
}

/**
 * Handles clicks on the main navigation buttons.
 */
function handleNavClick(event) {
    const targetView = event.target.dataset.targetView;
    if (targetView) { currentView = targetView;
        if (projectData && userData) { switchView(targetView); updateActiveNavButton(); if (targetView === 'messages') renderMessages(); if (targetView === 'dependencies') renderDependenciesView(); if (targetView === 'taskList') renderFullTaskList(); if (targetView === 'myTasks') renderMyTasksList();
        } else { console.warn("Nav attempt before data load."); const el = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]'); if (!el) appContent.innerHTML = '<p style="color: orange; padding: 20px;">Data lastes...</p>'; }
    }
}

/**
 * Handles saving the duration for a task.
 */
function handleSaveDuration(taskId) {
    const task = findTaskById(taskId); const input = document.getElementById(`durationInput_${taskId}`); if (!task || !input) return;
    const val = input.value; const duration = val === '' ? null : parseInt(val, 10);
    if (val === '' || (!isNaN(duration) && duration >= 0)) {
        if (task.EstimertVarighetDager !== duration) { const old = task.EstimertVarighetDager; task.EstimertVarighetDager = duration; console.log(`Duration updated for ${taskId} to ${duration ?? 'null'}`); addNotification('system', `Varighet Oppg ${task.OppgaveNr} endret fra ${old ?? 'N/A'} til ${duration ?? 'N/A'} av ${currentUser.Navn}.`, currentUser.BrukerID, taskId); recalculateTaskDates(task); renderApp(); showTaskDetail(taskId); }
    } else { alert("Ugyldig tall for varighet."); input.value = task.EstimertVarighetDager ?? ''; }
}

/**
 * Handles sending a simulated message.
 */
function handleSendMessage() {
     const rId = messageRecipientEl.value; const s = messageSubjectEl.value.trim(); const b = messageBodyEl.value.trim(); if (!currentUser) { alert("Ingen bruker valgt."); return; } if (!rId || !b) { alert('Velg mottaker og skriv melding.'); return; } addNotification('message', b, currentUser.BrukerID, null, rId, s); newMessageModal.style.display = 'none'; renderMessages(); renderNotificationsList(latestNotificationsListEl, 5);
}

/**
 * Attaches event listeners specific to the task detail view elements.
 */
function addTaskDetailEventListeners(task) { /* Delegation handles most now */ }

// === 5.4: EVENT HANDLERS END ===


// === 5.5: TASK ACTIONS & LOGIC START ===

/**
 * Updates the status of a task and handles related side effects.
 */
function updateTaskStatus(taskId, newStatus, options = {}) {
    const task = findTaskById(taskId); if (!task) return; const oldStatus = task.Status; if (oldStatus === newStatus && newStatus !== 'Utført') return; console.log(`Updating status for ${taskId}: ${oldStatus} -> ${newStatus}`); task.Status = newStatus; task.JustMadeReady = false; if (newStatus === 'Pågår') { if (!task.FaktiskStartDato) task.FaktiskStartDato = new Date(); task.GodkjentAvLeder = false; task.ProblemBeskrivelse = null; } if (newStatus === 'Venter på Godkjenning') { task.GodkjentAvLeder = false; task.ProblemBeskrivelse = null; } else if (newStatus === 'Utført') { task.FaktiskSluttDato = new Date(); task.GodkjentAvLeder = options.godkjent || task.GodkjentAvLeder; task.ProblemBeskrivelse = null; triggerSuccessorUpdate(taskId); } recalculateDependentTaskDates(task); addNotification('system', `Status Oppg ${task.OppgaveNr} endret til '${newStatus}' av ${currentUser.Navn}.`, currentUser.BrukerID, taskId); renderApp(); if (taskDetailViewEl.classList.contains('active-view')) { const durationInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]'); const currentId = durationInput ? durationInput.id.split('_')[1] : null; if (currentId === taskId) showTaskDetail(taskId); }
}

/**
 * Checks prerequisites for dependent tasks and updates their status.
 */
function triggerSuccessorUpdate(completedTaskId) {
    console.log(`Task ${completedTaskId} completed, checking successors...`);
    tasks.forEach(task => {
        if (task.ForutsetningerIDs?.includes(completedTaskId)) {
            if (task.Status === 'Venter på forutsetning' || task.Status === 'Ikke startet') {
                const wasWaiting = task.Status === 'Venter på forutsetning';
                if (arePrerequisitesMet(task)) {
                    task.Status = 'Ikke startet'; task.JustMadeReady = wasWaiting; task.BeregnetStartDato = calculateEarliestStartDate(task); addNotification('system', `Oppgave ${task.OppgaveNr} (${task.OppgaveNavn}) er klar til start!`, null, task.OppgaveID); recalculateTaskDates(task);
                } else { task.Status = 'Venter på forutsetning'; task.JustMadeReady = false; }
            }
        }
    });
}

/**
 * Checks if all prerequisites for a given task are met.
 */
function arePrerequisitesMet(task) {
    if (!task.ForutsetningerIDs?.length) return true;
    return task.ForutsetningerIDs.every(id => findTaskById(id)?.Status === 'Utført');
}

/**
 * Recalculates the end date for a task and triggers recalculation for successors.
 */
function recalculateTaskDates(task) {
    if (!task) return; console.log(`Recalculating dates for Task ${task.OppgaveNr}`); let changed = false; const oldStart = task.BeregnetStartDato, oldEnd = task.BeregnetSluttDato; const newStart = calculateEarliestStartDate(task); if (newStart !== null && (!oldStart || oldStart.getTime() !== newStart.getTime())) { task.BeregnetStartDato = newStart; changed = true; console.log(`  - Updated Start: ${formatDate(newStart)}`); } else if (newStart === null && oldStart !== null) { task.BeregnetStartDato = null; changed = true; console.log(`  - Cleared Start`); } if (task.BeregnetStartDato && task.EstimertVarighetDager !== null) { const newEnd = addWorkDays(task.BeregnetStartDato, task.EstimertVarighetDager); if (newEnd !== null && (!oldEnd || oldEnd.getTime() !== newEnd.getTime())) { task.BeregnetSluttDato = newEnd; changed = true; console.log(`  - Updated End: ${formatDate(newEnd)}`); } else if (newEnd === null && oldEnd !== null) { task.BeregnetSluttDato = null; changed = true; console.log(`  - Cleared End (addWorkDays fail)`); } } else { if (oldEnd !== null) { task.BeregnetSluttDato = null; changed = true; console.log(`  - Cleared End (no start/duration)`); } } if (changed) recalculateDependentTaskDates(task);
}

/**
 * Recalculates dates for tasks that depend on the provided task.
 */
function recalculateDependentTaskDates(prerequisiteTask) {
    const successors = tasks.filter(t => t.ForutsetningerIDs?.includes(prerequisiteTask.OppgaveID));
    console.log(`  - Found ${successors.length} successors for Task ${prerequisiteTask.OppgaveNr}. Recalculating...`);
    successors.forEach(succ => recalculateTaskDates(succ));
}

/**
 * Calculates the earliest possible start date for a task.
 */
 function calculateEarliestStartDate(task) {
    if (!task.ForutsetningerIDs?.length) { const psd = projectData?.project?.StartDato ? new Date(projectData.project.StartDato) : new Date(); psd.setHours(0,0,0,0); return psd; }
    let latestEnd = null;
    for (const id of task.ForutsetningerIDs) { const preReq = findTaskById(id); if (!preReq) return null; const end = preReq.FaktiskSluttDato || preReq.BeregnetSluttDato; if (!end || !(end instanceof Date) || isNaN(end)) return null; if (!latestEnd || end > latestEnd) latestEnd = end; }
    if (latestEnd) { const nextDay = new Date(latestEnd); nextDay.setDate(nextDay.getDate() + 1); nextDay.setHours(0,0,0,0); const psd = projectData?.project?.StartDato ? new Date(projectData.project.StartDato) : new Date(1970,0,1); psd.setHours(0,0,0,0); return nextDay > psd ? nextDay : psd; } return null;
}

/**
 * Simulates reporting a problem for a task.
 */
function reportProblem(taskId) {
    const task = findTaskById(taskId); if (!task || task.Status === 'Utført' || !currentUser) return; const reason = prompt(`Beskriv problemet for oppg ${task.OppgaveNr}:`, task.ProblemBeskrivelse || ''); if (reason !== null) { task.ProblemBeskrivelse = reason.trim() || "Problem"; updateTaskStatus(taskId, 'Problem Rapportert'); addNotification('system', `Problem rapportert Oppg ${task.OppgaveNr} av ${currentUser.Navn}: "${task.ProblemBeskrivelse}"`, currentUser.BrukerID, taskId); }
}

/**
 * Simulates resolving a problem for a task.
 */
function resolveProblem(taskId) {
    const task = findTaskById(taskId); if (!task || task.Status !== 'Problem Rapportert' || !currentUser) return; let prevStatus = 'Pågår'; if (!task.FaktiskStartDato) { prevStatus = arePrerequisitesMet(task) ? 'Ikke startet' : 'Venter på forutsetning'; } task.ProblemBeskrivelse = null; updateTaskStatus(taskId, prevStatus); addNotification('system', `Problem Oppg ${task.OppgaveNr} løst av ${currentUser.Navn}. Status -> '${prevStatus}'.`, currentUser.BrukerID, taskId);
}

/**
 * Admin action to mark a task as fully complete.
 */
 function adminMarkTaskComplete(taskId) {
    const task = findTaskById(taskId); if (!task || !currentUser?.RolleIDs.includes('ROLLE-PL')) return; console.log(`Admin completing ${taskId}`); if (!task.FaktiskStartDato) task.FaktiskStartDato = new Date(); if (!task.FaktiskSluttDato) task.FaktiskSluttDato = new Date(); task.Status = 'Utført'; task.GodkjentAvLeder = true; task.ProblemBeskrivelse = null; addNotification('system', `Oppg ${task.OppgaveNr} hurtigfullført av Admin.`, currentUser.BrukerID, taskId); triggerSuccessorUpdate(taskId); recalculateDependentTaskDates(task); renderApp(); if (taskDetailViewEl.classList.contains('active-view')) { const durationInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]'); const currentId = durationInput ? durationInput.id.split('_')[1] : null; if (currentId === taskId) showTaskDetail(taskId); }
}

/**
 * Determines if the current user can edit the duration of a task.
 */
function canEditDuration(task) {
    if (!currentUser) return false; const isPL = currentUser.RolleIDs.includes('ROLLE-PL'); const isResp = currentUser.RolleIDs.includes(task.AnsvarligRolleID); return (isPL || isResp) && task.Status !== 'Utført';
}

/**
 * Gets a list of pending actions for a specific user.
 */
 function getPendingActionsForUser(user) {
    if (!user || !tasks) return []; const actions = []; const isPL = user.RolleIDs.includes('ROLLE-PL');
    tasks.forEach(task => { const isResp = user.RolleIDs.includes(task.AnsvarligRolleID); if (isResp && task.Status === 'Ikke startet' && arePrerequisitesMet(task)) actions.push({ type: 'Start Oppgave', task: task }); if (isPL && task.Status === 'Venter på Godkjenning') actions.push({ type: 'Godkjenn Oppgave', task: task }); if (isPL && task.Status === 'Problem Rapportert') actions.push({ type: 'Løs Problem', task: task }); });
    actions.sort((a, b) => { const order = { "Løs Problem": 1, "Godkjenn Oppgave": 2, "Start Oppgave": 3 }; return (order[a.type] || 99) - (order[b.type] || 99); }); return actions;
}

// === 5.5: TASK ACTIONS & LOGIC END ===


// === 5.6: UTILITY FUNCTIONS START ===

function findTaskById(taskId) { return tasks?.find(t => t.OppgaveID === taskId); }
function findUserById(userId) { return users?.find(u => u.BrukerID === userId); }
function getRoleById(roleId) { return roles?.find(r => r.RolleID === roleId); }
function findUsersByRole(roleId) { return users?.filter(u => u.RolleIDs.includes(roleId)) ?? []; }
function getRolesForUser(user) { return user?.RolleIDs?.map(id => getRoleById(id)).filter(r => r) ?? []; }
function formatDate(date, includeTime = false) { if (!date || !(date instanceof Date) || isNaN(date)) return 'N/A'; try { const d = String(date.getDate()).padStart(2, '0'); const m = String(date.getMonth() + 1).padStart(2, '0'); const y = date.getFullYear(); let f = `${d}.${m}.${y}`; if (includeTime) { const h = String(date.getHours()).padStart(2, '0'); const min = String(date.getMinutes()).padStart(2, '0'); f += ` ${h}:${min}`; } return f; } catch (e) { console.error("Date format err:", date, e); return 'Feil dato'; } }
function addWorkDays(startDate, days) { if (!startDate || !(startDate instanceof Date) || isNaN(startDate) || days === null || isNaN(days) || days < 0) { console.warn("Invalid input to addWorkDays", startDate, days); return null; } let d = new Date(startDate); let added = 0, safety = 0; while (added < days && safety < (days * 3 + 100)) { d.setDate(d.getDate() + 1); const day = d.getDay(); if (day !== 0 && day !== 6) added++; safety++; } if (safety >= (days * 3 + 100)) { console.error("addWorkDays safety triggered"); return null; } d.setHours(0,0,0,0); return d; }
function calculateProjectProgress() { if (!tasks?.length) return 0; const completed = tasks.filter(t => t.Status === 'Utført').length; return Math.round((completed / tasks.length) * 100); }
function calculateProjectEta() { if (!tasks?.length) return 'Ukjent'; let latest = null; tasks.forEach(t => { const end = t.BeregnetSluttDato; if (end instanceof Date && !isNaN(end)) { if (!latest || end > latest) latest = end; } }); return latest ? formatDate(latest) : 'Ukjent'; }
function addNotification(type, body, senderId = null, taskId = null, recipientId = null, subject = null) { const n = { id: `notif-${Date.now()}-${Math.random()}`, type, body, senderId, recipientId, subject, taskId, timestamp: new Date(), read: false }; notifications.push(n); console.log("Notif added:", n); if (latestNotificationsListEl) renderNotificationsList(latestNotificationsListEl, 5); if (messageListContainerEl && currentView === 'messages') renderMessages(); }

// === 5.6: UTILITY FUNCTIONS END ===


// === 5.7: VIEW MANAGEMENT START ===

function switchView(viewId) { console.log("Switching view:", viewId); document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view')); const target = document.getElementById(viewId); if (target) { target.classList.add('active-view'); currentView = viewId; } else { console.error(`View ${viewId} not found! Fallback.`); const dash = document.getElementById('dashboard'); if (dash) { dash.classList.add('active-view'); currentView = 'dashboard'; } else appContent.innerHTML = `<p style="color:red;">FEIL: Finner ingen visninger!</p>`; } }
function updateActiveNavButton() { navButtons.forEach(b => b.classList.toggle('active', b.dataset.targetView === currentView)); }

// === 5.7: VIEW MANAGEMENT END ===


// === 5.8: APPLICATION STARTUP ===
document.addEventListener('DOMContentLoaded', init);
// === 5.8: APPLICATION STARTUP END ===

// === 5.9: CSS Blinking Animation & Action Styles START ===
const dynamicStyles = `
@keyframes blinkBackground {
  0%, 100% { background-color: inherit; }
  50% { background-color: var(--status-waiting); }
}
.card-pending-actions.has-actions {
    border-left: 5px solid var(--accent-color); /* Highlight card with actions */
}
#pendingActionsList li { /* Basic styling for action items */
    padding: 8px 10px;
    margin-bottom: 5px;
    border-radius: 3px;
    border: 1px solid var(--gray-medium);
    transition: background-color 0.2s ease;
}
#pendingActionsList li:hover {
    background-color: var(--gray-light);
}
#pendingActionsList .action-icon { /* Styling for icons */
    display: inline-block;
    margin-right: 8px;
    font-weight: bold;
}
#pendingActionsList .action-icon.problem { color: var(--status-problem); }
#pendingActionsList .action-icon.approval { color: var(--status-pending-approval); }
#pendingActionsList .action-icon.start { color: var(--status-completed); }

#pendingActionsList .highest-priority-action { /* Extra emphasis for top action */
    border-left: 4px solid var(--primary-color);
    background-color: #e7f1ff; /* Light blue background */
    font-weight: 600;
}
.task-item .cue { margin-left: 10px; font-size: 0.9em; padding: 2px 5px; border-radius: 3px; }
.task-item .cue-approval { background-color: var(--status-pending-approval); color: white;}
.task-item .cue-problem { background-color: var(--status-problem); color: white;}
.task-item .cue-ready { background-color: var(--status-completed); color: white;}

`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = dynamicStyles;
document.head.appendChild(styleSheet);
// === 5.9: CSS Blinking Animation & Action Styles END ===

// === 5: MAIN APPLICATION SCRIPT END ===
