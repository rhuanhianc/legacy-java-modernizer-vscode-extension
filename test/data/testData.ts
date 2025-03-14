// test/data/TestData.ts

/**
 * A collection of real-world Java code examples for testing the modernization rules.
 */
export class TestData {
  
    /**
     * A simple POJO class with getters/setters that can be converted to a record (Java 17+)
     */
    static readonly simplePojo = `
  package com.example.model;
  
  import java.util.Objects;
  
  public class Person {
      private final String name;
      private final int age;
      private final String email;
  
      public Person(String name, int age, String email) {
          this.name = name;
          this.age = age;
          this.email = email;
      }
  
      public String getName() {
          return name;
      }
  
      public int getAge() {
          return age;
      }
  
      public String getEmail() {
          return email;
      }
  
      @Override
      public boolean equals(Object o) {
          if (this == o) return true;
          if (o == null || getClass() != o.getClass()) return false;
          Person person = (Person) o;
          return age == person.age &&
                  Objects.equals(name, person.name) &&
                  Objects.equals(email, person.email);
      }
  
      @Override
      public int hashCode() {
          return Objects.hash(name, age, email);
      }
  
      @Override
      public String toString() {
          return "Person{" +
                  "name='" + name + '\\'' +
                  ", age=" + age +
                  ", email='" + email + '\\'' +
                  '}';
      }
  }`;
  
    /**
     * A class with multiple anonymous inner classes that can be converted to lambdas
     */
    static readonly withAnonymousClasses = `
  package com.example.service;
  
  import java.util.ArrayList;
  import java.util.Comparator;
  import java.util.List;
  import java.util.function.Predicate;
  import java.util.function.Consumer;
  
  public class UserService {
      private List<User> users = new ArrayList<>();
      
      public void processUsers() {
          // Sort users by name (should be converted to lambda)
          users.sort(new Comparator<User>() {
              @Override
              public int compare(User u1, User u2) {
                  return u1.getName().compareTo(u2.getName());
              }
          });
          
          // Filter active users (should be converted to lambda)
          Predicate<User> activeFilter = new Predicate<User>() {
              @Override
              public boolean test(User user) {
                  return user.isActive();
              }
          };
          
          // Print user details (should be converted to lambda)
          Consumer<User> printer = new Consumer<User>() {
              @Override
              public void accept(User user) {
                  System.out.println("User: " + user.getName());
              }
          };
          
          // This should NOT be converted (multiple methods)
          UserProcessor processor = new UserProcessor() {
              @Override
              public void process(User user) {
                  System.out.println("Processing: " + user.getName());
              }
              
              @Override
              public boolean validate(User user) {
                  return user != null && user.getEmail() != null;
              }
          };
          
          // Run a task (should be converted to lambda)
          Runnable task = new Runnable() {
              @Override
              public void run() {
                  System.out.println("Running user processing task");
              }
          };
          
          // Execute the task
          new Thread(task).start();
      }
  }
  
  interface UserProcessor {
      void process(User user);
      boolean validate(User user);
  }
  
  class User {
      private String name;
      private String email;
      private boolean active;
      
      // Getters and setters
      public String getName() { return name; }
      public void setName(String name) { this.name = name; }
      public String getEmail() { return email; }
      public void setEmail(String email) { this.email = email; }
      public boolean isActive() { return active; }
      public void setActive(boolean active) { this.active = active; }
  }`;
  
    /**
     * A class with for-each loops that can be converted to Stream API
     */
    static readonly withForEachLoops = `
  package com.example.processing;
  
  import java.util.ArrayList;
  import java.util.HashMap;
  import java.util.List;
  import java.util.Map;
  
  public class DataProcessor {
      
      public List<String> processItems(List<String> items) {
          // Simple mapping (convert to map)
          List<String> upperCaseItems = new ArrayList<>();
          for (String item : items) {
              upperCaseItems.add(item.toUpperCase());
          }
          
          // Filtering (convert to filter)
          List<String> filteredItems = new ArrayList<>();
          for (String item : items) {
              if (item.length() > 5) {
                  filteredItems.add(item);
              }
          }
          
          // Filtering and mapping (convert to filter and map)
          List<String> processedItems = new ArrayList<>();
          for (String item : items) {
              if (item.startsWith("a") && item.length() > 3) {
                  processedItems.add(item.substring(0, 3) + "...");
              }
          }
          
          // Simple iteration for side effects (convert to forEach)
          for (String item : items) {
              System.out.println("Processing: " + item);
          }
          
          // This should NOT be converted (nested loops)
          Map<String, Integer> wordCounts = new HashMap<>();
          for (String item : items) {
              String[] words = item.split("\\\\s+");
              for (String word : words) {
                  wordCounts.put(word, wordCounts.getOrDefault(word, 0) + 1);
              }
          }
          
          // This should be converted despite if-else (filter with ternary)
          List<String> formattedItems = new ArrayList<>();
          for (String item : items) {
              if (item.length() > 10) {
                  formattedItems.add(item.substring(0, 10) + "...");
              } else {
                  formattedItems.add(item);
              }
          }
          
          return formattedItems;
      }
  }`;
  
    /**
     * A class with null checks that can be converted to Optional
     */
    static readonly withNullChecks = `
  package com.example.nullhandling;
  
  import java.util.List;
  
  public class SafeProcessor {
      
      public String getFirstItemSafely(List<String> items) {
          // Simple null check (convert to Optional)
          if (items != null) {
              return items.isEmpty() ? null : items.get(0);
          }
          return null;
      }
      
      public void processUserData(User user) {
          // Null check with method call (convert to Optional)
          if (user != null) {
              user.process();
          }
          
          // Null check with property access (convert to Optional)
          if (user != null) {
              System.out.println("User name: " + user.getName());
          }
          
          // Null check with else (convert to ifPresentOrElse)
          if (user != null) {
              System.out.println("Processing user: " + user.getId());
          } else {
              System.out.println("No user to process");
          }
          
          // This should NOT be converted (complex condition)
          if (user != null && user.isActive()) {
              System.out.println("Active user: " + user.getName());
          }
          
          // This should be converted despite variable declaration
          if (user != null) {
              String name = user.getName();
              System.out.println("Normalized name: " + name.trim().toUpperCase());
          }
          
          // This should be converted (return different values)
          String department;
          if (user != null) {
              department = user.getDepartment();
          } else {
              department = "Unknown";
          }
          System.out.println("Department: " + department);
      }
  }
  
  class User {
      private String id;
      private String name;
      private String department;
      private boolean active;
      
      public void process() {
          System.out.println("Processing user: " + id);
      }
      
      // Getters and setters
      public String getId() { return id; }
      public String getName() { return name; }
      public String getDepartment() { return department; }
      public boolean isActive() { return active; }
  }`;
  
    /**
     * A complex class with multiple modernization opportunities
     */
    static readonly complexExample = `
  package com.example.comprehensive;
  
  import java.util.ArrayList;
  import java.util.HashMap;
  import java.util.List;
  import java.util.Map;
  import java.util.Comparator;
  import java.util.Collections;
  import java.util.function.Predicate;
  import java.util.function.Function;
  
  /**
   * This class demonstrates multiple modernization patterns
   * that can be detected and updated with the Java Modernizer.
   */
  public class CustomerManager {
      private List<Customer> customers;
      private Map<String, List<Order>> ordersByCustomer;
      
      public CustomerManager() {
          this.customers = new ArrayList<>();
          this.ordersByCustomer = new HashMap<>();
      }
      
      public void initialize() {
          // Anonymous Runnable that can be converted to lambda
          Runnable initializer = new Runnable() {
              @Override
              public void run() {
                  System.out.println("Initializing customer data...");
                  loadDefaultCustomers();
              }
          };
          
          // Execute the initializer
          initializer.run();
      }
      
      private void loadDefaultCustomers() {
          // Create some customers and orders
          Customer customer1 = new Customer("C001", "Alice", "alice@example.com");
          Customer customer2 = new Customer("C002", "Bob", "bob@example.com");
          Customer customer3 = new Customer("C003", "Charlie", "charlie@example.com");
          
          customers.add(customer1);
          customers.add(customer2);
          customers.add(customer3);
          
          // For each loop that can be converted to Stream.forEach
          for (Customer customer : customers) {
              System.out.println("Added customer: " + customer.getName());
              ordersByCustomer.put(customer.getId(), new ArrayList<>());
          }
      }
      
      public List<Customer> findActiveCustomers() {
          // For each with filtering that can be converted to Stream.filter
          List<Customer> activeCustomers = new ArrayList<>();
          for (Customer customer : customers) {
              if (customer.isActive() && customer.getLastOrderDate() != null) {
                  activeCustomers.add(customer);
              }
          }
          
          // Anonymous comparator that can be converted to lambda
          Collections.sort(activeCustomers, new Comparator<Customer>() {
              @Override
              public int compare(Customer c1, Customer c2) {
                  return c1.getLastOrderDate().compareTo(c2.getLastOrderDate());
              }
          });
          
          return activeCustomers;
      }
      
      public void processCustomer(String customerId) {
          // Null check that can be converted to Optional
          Customer customer = findCustomerById(customerId);
          if (customer != null) {
              System.out.println("Processing customer: " + customer.getName());
              processOrders(customer);
          }
      }
      
      private void processOrders(Customer customer) {
          // Null check with else that can be converted to Optional
          List<Order> orders = ordersByCustomer.get(customer.getId());
          if (orders != null) {
              // For each with transformation that can be converted to Stream.map
              List<String> orderIds = new ArrayList<>();
              for (Order order : orders) {
                  orderIds.add(order.getId());
              }
              
              // Print order IDs
              System.out.println("Orders for " + customer.getName() + ": " + String.join(", ", orderIds));
          } else {
              System.out.println("No orders found for " + customer.getName());
          }
      }
      
      public Customer findCustomerById(String id) {
          // For each that can be converted to Stream.filter.findFirst
          for (Customer customer : customers) {
              if (customer.getId().equals(id)) {
                  return customer;
              }
          }
          return null;
      }
      
      public List<Customer> searchCustomers(String keyword) {
          // Anonymous predicate that can be converted to lambda
          Predicate<Customer> searchPredicate = new Predicate<Customer>() {
              @Override
              public boolean test(Customer customer) {
                  return customer.getName().contains(keyword) || 
                         customer.getEmail().contains(keyword);
              }
          };
          
          // For each with complex filtering that can be converted to Stream operations
          List<Customer> results = new ArrayList<>();
          for (Customer customer : customers) {
              if (searchPredicate.test(customer)) {
                  results.add(customer);
              }
          }
          
          return results;
      }
      
      // This method demonstrates multiple patterns in a single complex operation
      public Map<String, List<String>> generateCustomerReport() {
          Map<String, List<String>> report = new HashMap<>();
          
          // For each with mapping and filtering (Stream candidate)
          for (Customer customer : customers) {
              // Null check (Optional candidate)
              if (customer.getEmail() != null) {
                  String domain = customer.getEmail().substring(customer.getEmail().indexOf('@') + 1);
                  
                  // Another null check (Optional candidate)
                  List<String> customersForDomain = report.get(domain);
                  if (customersForDomain == null) {
                      customersForDomain = new ArrayList<>();
                      report.put(domain, customersForDomain);
                  }
                  
                  customersForDomain.add(customer.getName());
              }
          }
          
          return report;
      }
  }
  
  class Customer {
      private String id;
      private String name;
      private String email;
      private boolean active = true;
      private String lastOrderDate;
      
      public Customer(String id, String name, String email) {
          this.id = id;
          this.name = name;
          this.email = email;
      }
      
      // Getters and setters
      public String getId() { return id; }
      public String getName() { return name; }
      public String getEmail() { return email; }
      public boolean isActive() { return active; }
      public String getLastOrderDate() { return lastOrderDate; }
      public void setLastOrderDate(String date) { this.lastOrderDate = date; }
  }
  
  class Order {
      private String id;
      private double amount;
      
      public Order(String id, double amount) {
          this.id = id;
          this.amount = amount;
      }
      
      public String getId() { return id; }
      public double getAmount() { return amount; }
  }`;
  }