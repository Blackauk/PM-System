import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Badge } from '../../../components/common/Badge';
import { SlideOver } from '../../../components/common/SlideOver';
import { SortableTable } from '../../../components/common/SortableTable';
import { Tabs } from '../../../components/common/Tabs';
import { DropdownMenu } from '../../../components/common/DropdownMenu';
import { showToast } from '../../../components/common/Toast';
import { Plus, Edit, Eye, MoreVertical, X } from 'lucide-react';
import { 
  loadUsers, 
  saveUsers, 
  loadRoles, 
  saveRoles, 
  loadSites,
  type User, 
  type Role 
} from '../mock/settingsData';
import { useAuth } from '../../../contexts/AuthContext';
import { SearchableMultiSelect } from '../../../components/common/SearchableMultiSelect';

// Permission modules as per requirements
const PERMISSION_MODULES = [
  'Defects',
  'Inspections',
  'Work Orders',
  'Assets',
  'Schedules',
  'Inventory',
  'Reports',
  'Handover',
  'Settings',
] as const;

// Permission actions
const PERMISSION_ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Approve'] as const;

// Determine which actions are relevant for each module
function getModuleActions(module: string): string[] {
  const baseActions = ['View', 'Create', 'Edit', 'Delete'];
  if (module === 'Inspections' || module === 'Defects' || module === 'Work Orders') {
    return ['View', 'Create', 'Edit', 'Delete', 'Approve'];
  }
  return baseActions;
}

// Create default permissions structure
function createDefaultPermissions(): Record<string, Record<string, boolean>> {
  const perms: Record<string, Record<string, boolean>> = {};
  PERMISSION_MODULES.forEach(module => {
    perms[module] = {};
    getModuleActions(module).forEach(action => {
      perms[module][action] = false;
    });
  });
  return perms;
}

export function UsersRolesSection() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState(loadUsers());
  const [roles, setRoles] = useState(loadRoles());
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  
  // User management state
  const [showUserDrawer, setShowUserDrawer] = useState(false);
  const [showUserViewDrawer, setShowUserViewDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<Partial<User>>({});
  const [userMenuOpenId, setUserMenuOpenId] = useState<string | null>(null);
  const userMenuRefs = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({});
  
  // Role management state
  const [showRoleDrawer, setShowRoleDrawer] = useState(false);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<Partial<Role>>({});
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const sites = loadSites();

  const filteredUsers = useMemo(() => {
    let filtered = [...users];
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.firstName.toLowerCase().includes(searchLower) ||
        u.lastName.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
      );
    }
    
    if (filterRole) {
      filtered = filtered.filter(u => u.role === filterRole);
    }
    
    if (filterStatus) {
      filtered = filtered.filter(u => u.status === filterStatus);
    }
    
    return filtered;
  }, [users, search, filterRole, filterStatus]);

  // Get or create ref for user menu
  const getUserMenuRef = (userId: string) => {
    if (!userMenuRefs.current[userId]) {
      userMenuRefs.current[userId] = { current: null };
    }
    return userMenuRefs.current[userId];
  };

  const handleAddUser = () => {
    setUserForm({
      firstName: '',
      lastName: '',
      email: '',
      role: 'Fitter',
      status: 'Active',
      siteIds: [],
    });
    setSelectedUser(null);
    setShowUserDrawer(true);
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setShowUserViewDrawer(true);
  };

  const handleEditUser = (user: User) => {
    setUserForm({ ...user });
    setSelectedUser(user);
    setShowUserDrawer(true);
    setUserMenuOpenId(null);
  };

  const handleDisableEnableUser = (user: User) => {
    if (!confirm(`Are you sure you want to ${user.status === 'Active' ? 'disable' : 'enable'} ${user.firstName} ${user.lastName}? ${user.status === 'Active' ? 'User won\'t be able to log in.' : ''}`)) {
      return;
    }
    
    setUsers(prev => {
      const updated = prev.map(u =>
        u.id === user.id
          ? { ...u, status: u.status === 'Active' ? 'Disabled' : 'Active' }
          : u
      );
      saveUsers(updated);
      return updated;
    });
    
    showToast(`User ${user.status === 'Active' ? 'disabled' : 'enabled'} successfully`, 'success');
    setUserMenuOpenId(null);
  };

  const handleSaveUser = () => {
    if (!userForm.firstName || !userForm.lastName || !userForm.email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userForm.email!)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    if (selectedUser) {
      // Update existing
      setUsers(prev => {
        const updated = prev.map(u => u.id === selectedUser.id ? { ...userForm, id: selectedUser.id } as User : u);
        saveUsers(updated);
        return updated;
      });
      showToast('User updated successfully', 'success');
    } else {
      // Create new
      const newUser: User = {
        id: `user-${Date.now()}`,
        firstName: userForm.firstName!,
        lastName: userForm.lastName!,
        email: userForm.email!,
        role: userForm.role || 'Fitter',
        status: userForm.status || 'Active',
        siteIds: userForm.siteIds || [],
      };
      setUsers(prev => {
        const updated = [...prev, newUser];
        saveUsers(updated);
        return updated;
      });
      showToast('User created successfully', 'success');
    }
    
    setShowUserDrawer(false);
    setUserForm({});
    setSelectedUser(null);
  };

  const handleAddRole = () => {
    setRoleForm({
      name: '',
      permissions: createDefaultPermissions(),
    });
    setSelectedRole(null);
    setShowRoleDrawer(true);
  };

  const handleEditRolePermissions = (role: Role) => {
    setSelectedRole(role);
    setShowPermissionsDrawer(true);
  };

  const handleSaveRole = () => {
    if (!selectedRole && !roleForm.name) {
      showToast('Please enter a role name', 'error');
      return;
    }

    if (selectedRole) {
      // Update existing role permissions
      setRoles(prev => {
        const updated = prev.map(r => r.id === selectedRole.id ? selectedRole : r);
        saveRoles(updated);
        return updated;
      });
      showToast('Role permissions updated successfully', 'success');
      setShowPermissionsDrawer(false);
      setSelectedRole(null);
    } else {
      // Create new role
      const newRole: Role = {
        id: `role-${Date.now()}`,
        name: roleForm.name!,
        permissions: roleForm.permissions || createDefaultPermissions(),
      };
      setRoles(prev => {
        const updated = [...prev, newRole];
        saveRoles(updated);
        return updated;
      });
      showToast('Role created successfully', 'success');
      setShowRoleDrawer(false);
      setRoleForm({});
    }
  };

  // Permission management helpers
  const togglePermission = (module: string, action: string) => {
    if (!selectedRole) return;
    
    setSelectedRole({
      ...selectedRole,
      permissions: {
        ...selectedRole.permissions,
        [module]: {
          ...(selectedRole.permissions[module] || {}),
          [action]: !(selectedRole.permissions[module]?.[action] || false),
        },
      },
    });
  };

  const toggleModulePermissions = (module: string) => {
    if (!selectedRole) return;
    
    const actions = getModuleActions(module);
    const allChecked = actions.every(action => selectedRole.permissions[module]?.[action] || false);
    
    setSelectedRole({
      ...selectedRole,
      permissions: {
        ...selectedRole.permissions,
        [module]: Object.fromEntries(
          actions.map(action => [action, !allChecked])
        ),
      },
    });
  };

  const toggleAllPermissions = () => {
    if (!selectedRole) return;
    
    const allChecked = PERMISSION_MODULES.every(module => {
      const actions = getModuleActions(module);
      return actions.every(action => selectedRole.permissions[module]?.[action] || false);
    });
    
    const newPerms: Record<string, Record<string, boolean>> = {};
    PERMISSION_MODULES.forEach(module => {
      const actions = getModuleActions(module);
      newPerms[module] = Object.fromEntries(
        actions.map(action => [action, !allChecked])
      );
    });
    
    setSelectedRole({
      ...selectedRole,
      permissions: newPerms,
    });
  };

  const userColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (_: any, row: User) => (
        <div className={row.status === 'Disabled' ? 'opacity-60' : ''}>
          <div className="font-medium text-gray-900">{row.firstName} {row.lastName}</div>
          <div className="text-sm text-gray-500">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (_: any, row: User) => (
        <Badge variant="default">{row.role}</Badge>
      ),
    },
    {
      key: 'sites',
      label: 'Site(s)',
      sortable: false,
      render: (_: any, row: User) => (
        <div className="text-sm text-gray-600">
          {row.siteIds.length > 0
            ? row.siteIds.map(id => sites.find(s => s.id === id)?.name).filter(Boolean).join(', ')
            : '—'}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, row: User) => (
        <Badge variant={row.status === 'Active' ? 'success' : 'default'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      sortable: true,
      render: (_: any, row: User) => (
        <div className="text-sm text-gray-600">
          {row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : 'Never'}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_: any, row: User) => {
        const menuRef = getUserMenuRef(row.id);
        const menuItems = [
          {
            label: 'View',
            icon: Eye,
            onClick: () => handleViewUser(row),
          },
          {
            label: 'Edit',
            icon: Edit,
            onClick: () => handleEditUser(row),
          },
          {
            label: row.status === 'Active' ? 'Disable' : 'Enable',
            icon: X,
            onClick: () => handleDisableEnableUser(row),
          },
        ];

        return (
          <div className="relative">
            <button
              ref={(el) => {
                if (menuRef) {
                  menuRef.current = el;
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setUserMenuOpenId(userMenuOpenId === row.id ? null : row.id);
              }}
              className="p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Actions menu"
            >
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
            {menuRef && (
              <DropdownMenu
                isOpen={userMenuOpenId === row.id}
                onClose={() => setUserMenuOpenId(null)}
                anchorRef={menuRef as React.RefObject<HTMLElement>}
                items={menuItems}
                width="w-48"
              />
            )}
          </div>
        );
      },
    },
  ];

  const roleColumns = [
    {
      key: 'name',
      label: 'Role',
      sortable: true,
      render: (_: any, row: Role) => (
        <div className="font-medium text-gray-900">{row.name}</div>
      ),
    },
    {
      key: 'permissions',
      label: 'Permissions',
      sortable: false,
      render: (_: any, row: Role) => {
        const moduleCount = Object.keys(row.permissions).length;
        const totalPermissions = Object.values(row.permissions).reduce((sum, mod) => sum + Object.keys(mod).length, 0);
        return (
          <div className="text-sm text-gray-600">
            {moduleCount} modules, {totalPermissions} permissions
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_: any, row: Role) => (
        <button
          onClick={() => handleEditRolePermissions(row)}
          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
          title="Edit Permissions"
        >
          <Edit className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const canEdit = currentUser?.role === 'Admin';

  return (
    <div className="space-y-6 w-full">
      <Tabs
        tabs={[
          {
            id: 'users',
            label: 'Users',
            content: (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search users..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    options={[
                      { value: '', label: 'All Roles' },
                      { value: 'Admin', label: 'Admin' },
                      { value: 'Manager', label: 'Manager' },
                      { value: 'Supervisor', label: 'Supervisor' },
                      { value: 'Fitter', label: 'Fitter' },
                      { value: 'Viewer', label: 'Viewer' },
                    ]}
                    className="w-40"
                  />
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    options={[
                      { value: '', label: 'All Statuses' },
                      { value: 'Active', label: 'Active' },
                      { value: 'Disabled', label: 'Disabled' },
                    ]}
                    className="w-40"
                  />
                  {canEdit && (
                    <Button onClick={handleAddUser}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  )}
                </div>

                <Card>
                  <div className="p-6">
                    <SortableTable
                      columns={userColumns}
                      data={filteredUsers}
                      getRowClassName={(row: User) => row.status === 'Disabled' ? 'opacity-60 bg-gray-50' : ''}
                    />
                  </div>
                </Card>
              </div>
            ),
          },
          {
            id: 'roles',
            label: 'Roles & Permissions',
            content: (
              <div className="mt-4 space-y-4">
                <div className="flex justify-end">
                  {canEdit && (
                    <Button onClick={handleAddRole}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Role
                    </Button>
                  )}
                </div>
                <Card>
                  <div className="p-6">
                    <SortableTable
                      columns={roleColumns}
                      data={roles}
                    />
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
        defaultTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
      />

      {/* Add/Edit User Drawer */}
      <SlideOver
        isOpen={showUserDrawer}
        onClose={() => {
          setShowUserDrawer(false);
          setUserForm({});
          setSelectedUser(null);
        }}
        title={selectedUser ? 'Edit User' : 'Add User'}
        width="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={userForm.firstName || ''}
              onChange={(e) => setUserForm(prev => ({ ...prev, firstName: e.target.value }))}
              required
            />
            <Input
              label="Last Name"
              value={userForm.lastName || ''}
              onChange={(e) => setUserForm(prev => ({ ...prev, lastName: e.target.value }))}
              required
            />
          </div>
          
          <Input
            label="Email"
            type="email"
            value={userForm.email || ''}
            onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
            required
          />
          
          <Select
            label="Role"
            value={userForm.role || 'Fitter'}
            onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value as User['role'] }))}
            options={[
              { value: 'Admin', label: 'Admin' },
              { value: 'Manager', label: 'Manager' },
              { value: 'Supervisor', label: 'Supervisor' },
              { value: 'Fitter', label: 'Fitter' },
              { value: 'Viewer', label: 'Viewer' },
            ]}
          />
          
          <Select
            label="Status"
            value={userForm.status || 'Active'}
            onChange={(e) => setUserForm(prev => ({ ...prev, status: e.target.value as User['status'] }))}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Disabled', label: 'Disabled' },
            ]}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assigned Sites
            </label>
            <SearchableMultiSelect
              options={sites.filter(s => s.status === 'Active').map(s => ({ value: s.id, label: s.name }))}
              selected={userForm.siteIds || []}
              onChange={(selected) => setUserForm(prev => ({ ...prev, siteIds: selected }))}
              placeholder="Select sites..."
            />
          </div>
          
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="primary" onClick={handleSaveUser} className="flex-1">
              {selectedUser ? 'Update User' : 'Create User'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowUserDrawer(false);
                setUserForm({});
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* View User Drawer (Read-only) */}
      <SlideOver
        isOpen={showUserViewDrawer}
        onClose={() => {
          setShowUserViewDrawer(false);
          setSelectedUser(null);
        }}
        title="User Details"
        width="lg"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <div className="text-gray-900">{selectedUser.firstName} {selectedUser.lastName}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="text-gray-900">{selectedUser.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <Badge variant="default">{selectedUser.role}</Badge>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Badge variant={selectedUser.status === 'Active' ? 'success' : 'default'}>
                {selectedUser.status}
              </Badge>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Sites</label>
              <div className="text-gray-900">
                {selectedUser.siteIds.length > 0
                  ? selectedUser.siteIds.map(id => sites.find(s => s.id === id)?.name).filter(Boolean).join(', ')
                  : 'None'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Login</label>
              <div className="text-gray-900">
                {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}
              </div>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Add Role Drawer */}
      <SlideOver
        isOpen={showRoleDrawer}
        onClose={() => {
          setShowRoleDrawer(false);
          setRoleForm({});
        }}
        title="Add Role"
        width="lg"
      >
        <div className="space-y-4">
          <Input
            label="Role Name"
            value={roleForm.name || ''}
            onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
            required
            placeholder="e.g., Custom Role"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Copy Permissions From (Optional)
            </label>
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  const templateRole = roles.find(r => r.id === e.target.value);
                  if (templateRole) {
                    setRoleForm(prev => ({ ...prev, permissions: JSON.parse(JSON.stringify(templateRole.permissions)) }));
                  }
                }
              }}
              options={[
                { value: '', label: 'None (start from scratch)' },
                ...roles.map(r => ({ value: r.id, label: r.name })),
              ]}
            />
          </div>
          
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="primary" onClick={handleSaveRole} className="flex-1" disabled={!roleForm.name}>
              Create Role
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowRoleDrawer(false);
                setRoleForm({});
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Permissions Editor Drawer */}
      <SlideOver
        isOpen={showPermissionsDrawer}
        onClose={() => {
          setShowPermissionsDrawer(false);
          setSelectedRole(null);
        }}
        title={selectedRole ? `Edit Permissions: ${selectedRole.name}` : 'Edit Permissions'}
        width="xl"
      >
        {selectedRole && (
          <div className="space-y-6">
            {/* Global Select All */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <div className="font-medium text-gray-900">All Permissions</div>
                <div className="text-sm text-gray-600">Toggle all permissions for this role</div>
              </div>
              <button
                onClick={toggleAllPermissions}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200"
              >
                Select All / Deselect All
              </button>
            </div>

            {/* Module Permissions */}
            <div className="space-y-4">
              {PERMISSION_MODULES.map(module => {
                const actions = getModuleActions(module);
                const modulePerms = selectedRole.permissions[module] || {};
                const allModuleChecked = actions.every(action => modulePerms[action] || false);
                
                return (
                  <div key={module} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Module Header */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                      <div className="font-semibold text-gray-900">{module}</div>
                      <button
                        onClick={() => toggleModulePermissions(module)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {allModuleChecked ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    
                    {/* Module Actions */}
                    <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                      {actions.map(action => (
                        <label key={action} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modulePerms[action] || false}
                            onChange={() => togglePermission(module, action)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{action}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="primary" onClick={handleSaveRole} className="flex-1">
                Save Permissions
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPermissionsDrawer(false);
                  setSelectedRole(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
