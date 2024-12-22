// @ts-check
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // v1.6.0
import { setupCache, buildMemoryStorage } from 'axios-cache-adapter'; // v2.7.3
import axiosRetry from 'axios-retry'; // v3.8.0
import { FormState, ValidationError } from '../../types/form';
import { validateFormState } from '../utils/validation';
import { FormSchema, FormSubmission, SubmissionStatus } from '../../../backend/shared/types/form.types';

// API Configuration Constants
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const CACHE_MAX_AGE = 300000; // 5 minutes
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Interface for pagination parameters
 */
interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for form filtering options
 */
interface FilterOptions {
  status?: SubmissionStatus;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
  tags?: string[];
}

/**
 * Interface for paginated response
 */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Enhanced API client for form management with caching and retry capabilities
 */
export class FormApiClient {
  private httpClient: AxiosInstance;
  private cache: any;

  constructor() {
    // Initialize cache adapter
    this.cache = setupCache({
      maxAge: CACHE_MAX_AGE,
      storage: buildMemoryStorage(),
      exclude: {
        query: false,
        methods: ['POST', 'PUT', 'DELETE', 'PATCH']
      }
    });

    // Initialize HTTP client with enhanced configuration
    this.httpClient = axios.create({
      baseURL: BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      adapter: this.cache.adapter
    });

    // Configure retry logic
    axiosRetry(this.httpClient, {
      retries: MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status === 429); // Retry on rate limit
      }
    });

    // Add request interceptor for auth
    this.httpClient.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          window.dispatchEvent(new CustomEvent('auth:required'));
        }
        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  /**
   * Creates a new form with validation
   */
  public async createForm(formState: FormState): Promise<FormSchema> {
    const validationResult = await validateFormState(formState);
    if (!validationResult.isValid) {
      throw new Error('Form validation failed: ' + 
        validationResult.errors.map(e => e.message).join(', '));
    }

    const response = await this.httpClient.post<FormSchema>('/forms', formState);
    return response.data;
  }

  /**
   * Retrieves a form by ID with caching
   */
  public async getForm(formId: string): Promise<FormSchema> {
    const response = await this.httpClient.get<FormSchema>(`/forms/${formId}`);
    return response.data;
  }

  /**
   * Updates an existing form with validation
   */
  public async updateForm(formId: string, formState: FormState): Promise<FormSchema> {
    const validationResult = await validateFormState(formState);
    if (!validationResult.isValid) {
      throw new Error('Form validation failed: ' + 
        validationResult.errors.map(e => e.message).join(', '));
    }

    const response = await this.httpClient.put<FormSchema>(`/forms/${formId}`, formState);
    await this.cache.store.removeItem(`/forms/${formId}`);
    return response.data;
  }

  /**
   * Retrieves paginated form submissions with filtering
   */
  public async getFormSubmissions(
    formId: string,
    params: PaginationParams,
    filters?: FilterOptions
  ): Promise<PaginatedResponse<FormSubmission>> {
    const queryParams = new URLSearchParams({
      page: params.page.toString(),
      limit: params.limit.toString(),
      ...(params.sortBy && { sortBy: params.sortBy }),
      ...(params.sortOrder && { sortOrder: params.sortOrder }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.search && { search: filters.search }),
      ...(filters?.tags && { tags: filters.tags.join(',') })
    });

    if (filters?.dateRange) {
      queryParams.append('startDate', filters.dateRange.start.toISOString());
      queryParams.append('endDate', filters.dateRange.end.toISOString());
    }

    const response = await this.httpClient.get<PaginatedResponse<FormSubmission>>(
      `/forms/${formId}/submissions?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Submits form data with validation
   */
  public async submitForm(formId: string, data: Record<string, unknown>): Promise<FormSubmission> {
    const response = await this.httpClient.post<FormSubmission>(
      `/forms/${formId}/submissions`,
      data,
      {
        headers: {
          'X-Client-Version': process.env.NEXT_PUBLIC_VERSION || '1.0.0',
          'X-Source': 'web'
        }
      }
    );
    return response.data;
  }

  /**
   * Clears form cache by pattern
   */
  public async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      const keys = await this.cache.store.keys();
      const matchingKeys = keys.filter((key: string) => key.includes(pattern));
      await Promise.all(matchingKeys.map((key: string) => 
        this.cache.store.removeItem(key)
      ));
    } else {
      await this.cache.store.clear();
    }
  }

  /**
   * Normalizes API errors for consistent handling
   */
  private normalizeError(error: any): Error {
    if (error.response?.data?.errors) {
      return new Error(error.response.data.errors
        .map((e: ValidationError) => e.message)
        .join(', '));
    }
    return error;
  }
}

// Export singleton instance
export const formApi = new FormApiClient();