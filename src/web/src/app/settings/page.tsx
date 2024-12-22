'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form'; // ^7.0.0
import { zodResolver } from '@hookform/resolvers/zod'; // ^3.0.0
import { z } from 'zod'; // ^3.0.0
import Card from '../../components/shared/Card';
import Input from '../../components/shared/Input';
import Button from '../../components/shared/Button';
import Toast from '../../components/shared/Toast';

// Validation schema for settings form
const settingsSchema = z.object({
  accountName: z.string().min(1, 'Account name is required'),
  email: z.string().email('Please enter a valid email'),
  twilioApiKey: z.string().min(1, 'Twilio API key is required'),
  twilioAccountSid: z.string().min(1, 'Twilio Account SID is required'),
  messageBirdApiKey: z.string().min(1, 'MessageBird API key is required'),
  aiConfidenceThreshold: z.number()
    .min(0, 'Threshold must be between 0 and 100')
    .max(100, 'Threshold must be between 0 and 100'),
  notificationEmail: z.string().email('Please enter a valid notification email'),
  notificationPreferences: z.object({
    emailNotifications: z.boolean(),
    smsNotifications: z.boolean(),
    aiHandoffAlerts: z.boolean()
  })
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const SettingsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
    show: boolean;
  }>({ type: 'success', message: '', show: false });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      notificationPreferences: {
        emailNotifications: true,
        smsNotifications: true,
        aiHandoffAlerts: true
      }
    }
  });

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        // TODO: Replace with actual API call
        const response = await fetch('/api/settings');
        const data = await response.json();
        
        // Populate form with existing settings
        Object.entries(data).forEach(([key, value]) => {
          setValue(key as keyof SettingsFormData, value);
        });
      } catch (error) {
        setToast({
          type: 'error',
          message: 'Failed to load settings',
          show: true
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [setValue]);

  // Handle form submission
  const onSubmit = async (data: SettingsFormData) => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      setToast({
        type: 'success',
        message: 'Settings updated successfully',
        show: true
      });
    } catch (error) {
      setToast({
        type: 'error',
        message: 'Failed to update settings',
        show: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Account Settings */}
        <Card variant="default" padding="lg">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Account Settings</h2>
          <div className="space-y-4">
            <Input
              label="Account Name"
              type="text"
              error={errors.accountName?.message}
              {...register('accountName')}
            />
            <Input
              label="Email Address"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
        </Card>

        {/* SMS Provider Settings */}
        <Card variant="default" padding="lg">
          <h2 className="text-xl font-medium text-gray-900 mb-6">SMS Provider Settings</h2>
          <div className="space-y-4">
            <Input
              label="Twilio API Key"
              type="password"
              error={errors.twilioApiKey?.message}
              {...register('twilioApiKey')}
            />
            <Input
              label="Twilio Account SID"
              type="password"
              error={errors.twilioAccountSid?.message}
              {...register('twilioAccountSid')}
            />
            <Input
              label="MessageBird API Key"
              type="password"
              error={errors.messageBirdApiKey?.message}
              {...register('messageBirdApiKey')}
            />
          </div>
        </Card>

        {/* AI Configuration */}
        <Card variant="default" padding="lg">
          <h2 className="text-xl font-medium text-gray-900 mb-6">AI Configuration</h2>
          <div className="space-y-4">
            <Input
              label="AI Confidence Threshold (%)"
              type="number"
              error={errors.aiConfidenceThreshold?.message}
              {...register('aiConfidenceThreshold', { valueAsNumber: true })}
            />
          </div>
        </Card>

        {/* Notification Settings */}
        <Card variant="default" padding="lg">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Notification Settings</h2>
          <div className="space-y-4">
            <Input
              label="Notification Email"
              type="email"
              error={errors.notificationEmail?.message}
              {...register('notificationEmail')}
            />
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary-600"
                  {...register('notificationPreferences.emailNotifications')}
                />
                <span className="text-gray-700">Email Notifications</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary-600"
                  {...register('notificationPreferences.smsNotifications')}
                />
                <span className="text-gray-700">SMS Notifications</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary-600"
                  {...register('notificationPreferences.aiHandoffAlerts')}
                />
                <span className="text-gray-700">AI Handoff Alerts</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            variant="ghost"
            onClick={() => reset()}
            type="button"
            isDisabled={isLoading}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isLoading}
            isDisabled={isLoading}
          >
            Save Changes
          </Button>
        </div>
      </form>

      {/* Toast Notifications */}
      {toast.show && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(prev => ({ ...prev, show: false }))}
          position="top-right"
          duration={5000}
        />
      )}
    </div>
  );
};

export default SettingsPage;