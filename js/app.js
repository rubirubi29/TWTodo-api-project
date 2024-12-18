class TaskWave {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeServiceWorker();
        this.renderTasks();
        this.updateStats(); // Initialize stats on load
    }

    initializeElements() {
        this.taskForm = document.getElementById('task-form');
        this.taskList = document.getElementById('task-list');
        this.taskModal = document.getElementById('task-modal');
        this.addTaskBtn = document.getElementById('add-task-btn');
        this.cancelBtn = document.getElementById('cancel-btn');
        this.closeBtn = document.querySelector('.close-btn');
        this.installBtn = document.getElementById('install-btn');
        this.totalTasksEl = document.getElementById('total-tasks');
        this.pendingTasksEl = document.getElementById('pending-tasks');
        this.completedTasksEl = document.getElementById('completed-tasks');
        this.deferredPrompt = null;
    }

    initializeEventListeners() {
        this.taskForm.addEventListener('submit', this.handleTaskSubmit.bind(this));
        this.addTaskBtn.addEventListener('click', () => this.openModal());
        this.cancelBtn.addEventListener('click', () => this.closeModal());
        this.closeBtn.addEventListener('click', () => this.closeModal());

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', this.handleFilter.bind(this));
        });

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.installBtn.classList.remove('hidden');
        });
        
        this.installBtn.addEventListener('click', this.installApp.bind(this));
        setInterval(() => this.checkReminders(), 60000);
    }

    initializeServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
        }
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        const taskInput = document.getElementById('task-input');
        const deadlineInput = document.getElementById('task-deadline');

        const task = {
            id: Date.now(),
            text: taskInput.value,
            deadline: new Date(deadlineInput.value).getTime(),
            completed: false,
            created: Date.now()
        };

        this.tasks.push(task);
        this.saveTasks();
        this.updateStats();
        this.renderTasks();
        this.closeModal();
        
        taskInput.value = '';
        deadlineInput.value = '';
    }

    editTask(id) {
        const task = this.tasks.find(task => task.id === id);
        if (task) {
            this.openModal(task);
            const taskInput = document.getElementById('task-input');
            const deadlineInput = document.getElementById('task-deadline');
            const modalTitle = document.getElementById('modal-title');

            modalTitle.textContent = 'Edit Task';
            taskInput.value = task.text;
            deadlineInput.value = new Date(task.deadline).toISOString().slice(0, 16);

            this.taskForm.onsubmit = (e) => {
                e.preventDefault();
                task.text = taskInput.value;
                task.deadline = new Date(deadlineInput.value).getTime();
                
                this.saveTasks();
                this.updateStats();
                this.renderTasks();
                this.closeModal();
                
                this.taskForm.onsubmit = this.handleTaskSubmit.bind(this);
            };
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(task => task.id !== id);
        this.saveTasks();
        this.updateStats();
        this.renderTasks();
    }

    toggleComplete(id) {
        const task = this.tasks.find(task => task.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.updateStats();
            this.renderTasks();
        }
    }

    handleFilter(e) {
        const filterBtn = e.target.closest('.filter-btn');
        if (!filterBtn) return;

        const filter = filterBtn.dataset.filter;
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        filterBtn.classList.add('active');

        const tasks = this.tasks;
        let filteredTasks = [];

        switch(filter) {
            case 'completed':
                filteredTasks = tasks.filter(task => task.completed);
                break;
            case 'pending':
                filteredTasks = tasks.filter(task => !task.completed);
                break;
            default:
                filteredTasks = tasks;
        }

        this.renderFilteredTasks(filteredTasks);
    }

    renderFilteredTasks(filteredTasks) {
        this.taskList.innerHTML = '';
        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            
            const isUrgent = !task.completed && (task.deadline - Date.now() <= 86400000);
            if (isUrgent) li.classList.add('urgent');

            li.innerHTML = `
                <div class="task-checkbox ${task.completed ? 'completed' : ''}" 
                     onclick="app.toggleComplete(${task.id})">
                    <i class="fas fa-check"></i>
                </div>
                <div class="task-content">
                    <h3 class="task-title">${task.text}</h3>
                    <span class="task-deadline">
                        <i class="far fa-calendar-alt"></i>
                        ${new Date(task.deadline).toLocaleString()}
                    </span>
                </div>
                <div class="task-actions">
                    <button class="task-btn edit-btn" onclick="app.editTask(${task.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-btn delete-btn" onclick="app.deleteTask(${task.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            this.taskList.appendChild(li);
        });
    }

    renderTasks() {
        const activeFilter = document.querySelector('.filter-btn.active');
        const filter = activeFilter ? activeFilter.dataset.filter : 'all';

        let filteredTasks;
        switch(filter) {
            case 'completed':
                filteredTasks = this.tasks.filter(task => task.completed);
                break;
            case 'pending':
                filteredTasks = this.tasks.filter(task => !task.completed);
                break;
            default:
                filteredTasks = this.tasks;
        }

        this.renderFilteredTasks(filteredTasks);
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const pending = total - completed;

        if (this.totalTasksEl) this.totalTasksEl.textContent = total;
        if (this.pendingTasksEl) this.pendingTasksEl.textContent = pending;
        if (this.completedTasksEl) this.completedTasksEl.textContent = completed;
    }

    openModal(task = null) {
        this.taskModal.classList.remove('hidden');
        if (!task) {
            document.getElementById('modal-title').textContent = 'Add New Task';
            this.taskForm.reset();
        }
    }

    closeModal() {
        this.taskModal.classList.add('hidden');
        this.taskForm.reset();
        this.taskForm.onsubmit = this.handleTaskSubmit.bind(this);
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    checkReminders() {
        const now = Date.now();
        this.tasks.forEach(task => {
            if (!task.completed && task.deadline) {
                const timeUntilDeadline = task.deadline - now;
                if (timeUntilDeadline <= 86400000 && timeUntilDeadline > 0) {
                    this.showNotification(task);
                }
            }
        });
    }

    async showNotification(task) {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification('Task Reminder', {
                    body: `Task "${task.text}" is due in 24 hours!`,
                    icon: '/icons/icon-192x192.png'
                });
            }
        }
    }

    async installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const result = await this.deferredPrompt.userChoice;
            if (result.outcome === 'accepted') {
                this.installBtn.classList.add('hidden');
            }
            this.deferredPrompt = null;
        }
    }
}

const app = new TaskWave();